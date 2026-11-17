package ma.neurocare.reminder.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.domain.DoseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Les statuts sont passés en paramètres liés, jamais en littéraux JPQL : Hibernate caste un littéral
 * d'enum vers un type nommé d'après la classe Java ({@code ::DoseStatus}) au lieu de {@code dose_status}.
 */
public interface DoseEventRepository extends JpaRepository<DoseEvent, UUID> {

    /** Verrou pessimiste : deux confirmations simultanées de la même prise sont sérialisées. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DoseEvent d where d.id = :id")
    Optional<DoseEvent> findForUpdate(@Param("id") UUID id);

    @Query("""
            select d from DoseEvent d
             where d.seniorId = :seniorId and d.datePrevue >= :from and d.datePrevue < :to
             order by d.datePrevue
            """)
    List<DoseEvent> findForSenior(@Param("seniorId") UUID seniorId, @Param("from") Instant from,
                                  @Param("to") Instant to);

    /** Premier envoi : prises en attente arrivées à échéance et pas encore notifiées. */
    @Query("""
            select d from DoseEvent d
             where d.statut = :pending
               and d.notificationEnvoyee = false and d.datePrevue <= :now
             order by d.datePrevue
            """)
    List<DoseEvent> findDueForNotification(@Param("now") Instant now, @Param("pending") DoseStatus pending);

    default List<DoseEvent> findDueForNotification(Instant now) {
        return findDueForNotification(now, DoseStatus.EN_ATTENTE);
    }

    /** Relance unique : prises notifiées, toujours en attente, dont l'heure prévue est antérieure au seuil. */
    @Query("""
            select d from DoseEvent d
             where d.statut = :pending
               and d.notificationEnvoyee = true and d.relanceEnvoyee = false and d.datePrevue <= :threshold
             order by d.datePrevue
            """)
    List<DoseEvent> findDueForRelance(@Param("threshold") Instant threshold, @Param("pending") DoseStatus pending);

    default List<DoseEvent> findDueForRelance(Instant threshold) {
        return findDueForRelance(threshold, DoseStatus.EN_ATTENTE);
    }

    @Query("""
            select d from DoseEvent d
             where d.statut = :pending
               and d.scheduleId in :scheduleIds and d.datePrevue > :after
            """)
    List<DoseEvent> findPendingAfter(@Param("scheduleIds") Collection<UUID> scheduleIds,
                                     @Param("after") Instant after, @Param("pending") DoseStatus pending);

    default List<DoseEvent> findPendingAfter(Collection<UUID> scheduleIds, Instant after) {
        return findPendingAfter(scheduleIds, after, DoseStatus.EN_ATTENTE);
    }

    /** EF-RE-07 : un rappel désactivé produit DESACTIVE, jamais SANS_REPONSE. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update DoseEvent d set d.statut = :desactive,
                                   d.version = d.version + 1
             where d.statut = :pending and d.scheduleId in :scheduleIds
            """)
    int deactivatePendingBySchedules(@Param("scheduleIds") Collection<UUID> scheduleIds,
                                     @Param("pending") DoseStatus pending, @Param("desactive") DoseStatus desactive);

    default int deactivatePendingBySchedules(Collection<UUID> scheduleIds) {
        return deactivatePendingBySchedules(scheduleIds, DoseStatus.EN_ATTENTE, DoseStatus.DESACTIVE);
    }

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update DoseEvent d set d.statut = :desactive,
                                   d.version = d.version + 1
             where d.statut = :pending and d.seniorId = :seniorId
            """)
    int deactivatePendingBySenior(@Param("seniorId") UUID seniorId, @Param("pending") DoseStatus pending,
                                  @Param("desactive") DoseStatus desactive);

    default int deactivatePendingBySenior(UUID seniorId) {
        return deactivatePendingBySenior(seniorId, DoseStatus.EN_ATTENTE, DoseStatus.DESACTIVE);
    }
}
