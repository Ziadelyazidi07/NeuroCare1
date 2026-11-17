package ma.neurocare.consent.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Paire senior–aidant (table {@code caregiver_links}). Active uniquement après
 * consentement explicite du senior au partage familial (EF-CO-01).
 */
@Entity
@Table(name = "caregiver_links", uniqueConstraints = @UniqueConstraint(columnNames = {"senior_id", "aidant_id"}))
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CaregiverLink extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "aidant_id", nullable = false, updatable = false)
    private UUID aidantId;

    /** Ex. fille, fils, voisin. */
    @Column(name = "lien_parente", length = 40)
    private String lienParente;

    /** Ex. « Baba », « Papa chéri » — utilisé dans les messages vocaux. */
    @Column(name = "surnom_senior", length = 60)
    private String surnomSenior;

    @Column(name = "consentement_valide", nullable = false)
    private boolean consentementValide;

    @Column(name = "date_consentement")
    private Instant dateConsentement;

    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation = Instant.now();

    public CaregiverLink(UUID seniorId, UUID aidantId, String lienParente, String surnomSenior) {
        this.seniorId = seniorId;
        this.aidantId = aidantId;
        this.lienParente = lienParente;
        this.surnomSenior = surnomSenior;
    }
}
