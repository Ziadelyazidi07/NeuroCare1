package ma.neurocare.reminder.domain;

import java.time.Instant;
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
 * Une prise ne quitte EN_ATTENTE que vers un seul statut final (cahier §6.5).
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

    /** Idempotence des confirmations (en-tête Idempotency-Key ou clientRequestId hors ligne). */
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

    public void confirm(Instant at, String clientRequestId) {
        requirePending();
        this.statut = DoseStatus.CONFIRME;
        this.horodatageAction = at;
        this.clientRequestId = clientRequestId;
    }

    public void markNoResponse() {
        requirePending();
        this.statut = DoseStatus.SANS_REPONSE;
    }

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

    private void requirePending() {
        if (statut.isFinal()) {
            throw BusinessException.invalidTransition("La prise est déjà clôturée (" + statut + ").");
        }
    }
}
