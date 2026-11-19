package ma.neurocare.user.domain;

import java.util.UUID;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;
import ma.neurocare.common.domain.Language;

/**
 * Préférences du senior (table {@code senior_profiles}, relation 1–1 avec {@code users}).
 * L'identifiant est celui de l'utilisateur senior.
 */
@Entity
@Table(name = "senior_profiles")
@AttributeOverride(name = "id", column = @Column(name = "user_id", nullable = false, updatable = false))
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SeniorProfile extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "langue", nullable = false, length = 10)
    private Language langue = Language.DARIJA;

    @Column(name = "fuseau", nullable = false, length = 40)
    private String fuseau = "Africa/Casablanca";

    @Column(name = "taille_police", nullable = false)
    private short taillePolice = 24;

    @Column(name = "contraste_eleve", nullable = false)
    private boolean contrasteEleve = true;

    @Column(name = "delai_sans_reponse_min", nullable = false)
    private short delaiSansReponseMin = 30;

    @Column(name = "contact_urgence_nom", length = 120)
    private String contactUrgenceNom;

    @Column(name = "contact_urgence_tel", length = 20)
    private String contactUrgenceTel;

    @Column(name = "donnees_fictives", nullable = false)
    private boolean donneesFictives;

    /** Année de naissance seulement (minimisation, cahier §13.2) : sert à afficher l'âge. */
    @Column(name = "annee_naissance")
    private Short anneeNaissance;

    public SeniorProfile(UUID seniorUserId) {
        super(seniorUserId);
    }
}
