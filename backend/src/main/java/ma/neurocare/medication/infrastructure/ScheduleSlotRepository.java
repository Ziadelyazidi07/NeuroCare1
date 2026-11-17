package ma.neurocare.medication.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import ma.neurocare.medication.application.ScheduleSlot;
import ma.neurocare.medication.domain.MedicationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Projections d'horaires pour le moteur de rappel. */
public interface ScheduleSlotRepository extends JpaRepository<MedicationSchedule, UUID> {

    String SLOT = """
            select new ma.neurocare.medication.application.ScheduleSlot(
                s.id, m.id, m.seniorId, m.nomMedicament, m.consigne, s.heureRappel, s.joursSemaine,
                m.dateDebut, m.dateFin, s.actif, m.actif)
              from MedicationSchedule s join s.medication m
            """;

    @Query(SLOT + " where s.actif = true and m.actif = true")
    List<ScheduleSlot> findAllActive();

    @Query(SLOT + " where s.actif = true and m.actif = true and m.seniorId = :seniorId")
    List<ScheduleSlot> findActiveBySenior(@Param("seniorId") UUID seniorId);

    @Query(SLOT + " where m.id = :medicationId")
    List<ScheduleSlot> findByMedication(@Param("medicationId") UUID medicationId);

    @Query(SLOT + " where s.id in :ids")
    List<ScheduleSlot> findByIds(@Param("ids") Collection<UUID> ids);
}
