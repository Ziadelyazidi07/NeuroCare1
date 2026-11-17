package ma.neurocare.audit.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

/**
 * Trace des accès aux données de santé et des exports (table {@code audit_logs}).
 * L'acteur passe à NULL si son compte est supprimé (action conservée anonymisée).
 */
@Entity
@Immutable
@Table(name = "audit_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "acteur_id", updatable = false)
    private UUID acteurId;

    /** Ex. READ_DASHBOARD, EXPORT_PDF. */
    @Column(name = "action", nullable = false, length = 60, updatable = false)
    private String action;

    @Column(name = "cible_type", length = 40, updatable = false)
    private String cibleType;

    @Column(name = "cible_id", updatable = false)
    private UUID cibleId;

    @Column(name = "ip", length = 45, updatable = false)
    private String ip;

    @Column(name = "horodatage", nullable = false, updatable = false)
    private Instant horodatage = Instant.now();

    public AuditLog(UUID acteurId, String action, String cibleType, UUID cibleId, String ip) {
        this.acteurId = acteurId;
        this.action = action;
        this.cibleType = cibleType;
        this.cibleId = cibleId;
        this.ip = ip;
    }
}
