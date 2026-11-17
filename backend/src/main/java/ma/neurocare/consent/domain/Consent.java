package ma.neurocare.consent.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * État courant d'un consentement d'un senior (table {@code consents}).
 */
@Entity
@Table(name = "consents", uniqueConstraints = @UniqueConstraint(columnNames = {"senior_id", "type"}))
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Consent extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "type", nullable = false, updatable = false, columnDefinition = "consent_type")
    private ConsentType type;

    @Column(name = "accorde", nullable = false)
    private boolean accorde;

    /** Version de la notice d'information affichée lors de l'accord. */
    @Column(name = "version_texte", nullable = false, length = 20)
    private String versionTexte;

    @Column(name = "date_maj", nullable = false)
    private Instant dateMaj = Instant.now();

    public Consent(UUID seniorId, ConsentType type, boolean accorde, String versionTexte) {
        this.seniorId = seniorId;
        this.type = type;
        this.accorde = accorde;
        this.versionTexte = versionTexte;
    }
}
