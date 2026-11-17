package ma.neurocare.reminder.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;
import ma.neurocare.common.exception.BusinessException;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Prise prévue d'un traitement (table {@code dose_events}). Unique par (horaire, date prévue).
 *
 * <p>Cycle de vie (cahier §9.1) : EN_ATTENTE → CONFIRME | SANS_REPONSE | DESACTIVE, états finaux.
 * Seule exception : une confirmation faite hors ligne <em>avant</em> la clôture et synchronisée après
 * fait passer SANS_REPONSE → CONFIRME.
 */
@Entity
@Table(name = "dose_events", uniqueConstraints = @UniqueConstraint(columnNames = {"schedule_id", "date_prevue"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DoseEvent extends BaseEntity {

    @Column(name = "schedule_id", nullable = false, updatable = false)
    private UUID scheduleId;

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "date_prevue", nullable = false, updatable = false)
    private Instant datePrevue;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "statut", nullable = false, columnDefinition = "dose_status")
    private DoseStatus statut = DoseStatus.EN_ATTENTE;

    @Column(name = "horodatage_action")
    private Instant horodatageAction;

    @Column(name = "relance_envoyee", nullable = false)
    private boolean relanceEnvoyee;

    @Column(name = "notification_envoyee", nullable = false)
    private boolean notificationEnvoyee;

    /** Clé d'idempotence de la confirmation appliquée (en-tête Idempotency-Key ou clientRequestId). */
    @Column(name = "client_request_id", length = 64)
    private String clientRequestId;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    public DoseEvent(UUID scheduleId, UUID seniorId, Instant datePrevue) {
        this.scheduleId = scheduleId;
        this.seniorId = seniorId;
        this.datePrevue = datePrevue;
    }

    /**
     * Applique une confirmation du senior.
     *
     * @param key      clé d'idempotence (peut être nulle)
     * @param clientAt horodatage côté téléphone (peut être nul ; borné à {@code now})
     * @param now      instant serveur
     * @param timeout  délai SANS_REPONSE effectif du senior
     */
    public ConfirmationOutcome confirm(String key, Instant clientAt, Instant now, Duration timeout) {
        if (key != null && key.equals(clientRequestId)) {
            return ConfirmationOutcome.ALREADY_APPLIED;
        }
        // Précision PostgreSQL (µs) : la réponse rejouée relit la base et doit être identique (CA-04).
        Instant actionAt = (clientAt == null || clientAt.isAfter(now) ? now : clientAt).truncatedTo(ChronoUnit.MICROS);
        return switch (statut) {
            case EN_ATTENTE -> {
                markConfirmed(actionAt, key);
                yield ConfirmationOutcome.APPLIED;
            }
            case SANS_REPONSE -> {
                Instant closedAt = datePrevue.plus(timeout);
                if (clientAt != null && actionAt.isBefore(closedAt)) {
                    markConfirmed(actionAt, key);
                    yield ConfirmationOutcome.APPLIED_LATE;
                }
                yield ConfirmationOutcome.REJECTED_AFTER_CLOSURE;
            }
            case CONFIRME, DESACTIVE -> ConfirmationOutcome.REJECTED_FINAL;
        };
    }

    public void markNoResponse() {
        requirePending();
        this.statut = DoseStatus.SANS_REPONSE;
    }

    /** Traitement désactivé ou consentement RAPPELS révoqué : jamais SANS_REPONSE (EF-RE-07). */
    public void deactivate() {
        requirePending();
        this.statut = DoseStatus.DESACTIVE;
    }

    public void markNotificationSent() {
        this.notificationEnvoyee = true;
    }

    public void markRelanceSent() {
        this.relanceEnvoyee = true;
    }

    private void markConfirmed(Instant at, String key) {
        this.statut = DoseStatus.CONFIRME;
        this.horodatageAction = at;
        this.clientRequestId = key;
    }

    private void requirePending() {
        if (statut.isFinal()) {
            throw BusinessException.invalidTransition("La prise est déjà clôturée (" + statut + ").");
        }
    }
}
