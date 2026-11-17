package ma.neurocare.cognitive.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;
import ma.neurocare.common.domain.Language;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Résultat brut d'un exercice (table {@code cognitive_sessions}, EF-CG-02).
 * Aucune étiquette normal / pathologique, aucun score de risque : données d'exécution uniquement.
 */
@Entity
@Table(name = "cognitive_sessions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CognitiveSession extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "date_exercice", nullable = false, updatable = false)
    private Instant dateExercice;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_exercice", nullable = false, length = 40, updatable = false)
    private ExerciseType typeExercice;

    @Enumerated(EnumType.STRING)
    @Column(name = "langue", nullable = false, length = 10, updatable = false)
    private Language langue;

    /** Ex. mots présentés, propositions, mots choisis, temps de réponse (cahier §6.4). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "resultat_brut", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> resultatBrut;

    @Column(name = "taux_reussite", precision = 5, scale = 2, updatable = false)
    private BigDecimal tauxReussite;

    @Column(name = "duree_sec", updatable = false)
    private Integer dureeSec;

    @Column(name = "interrompu", nullable = false, updatable = false)
    private boolean interrompu;

    public CognitiveSession(UUID seniorId, Instant dateExercice, ExerciseType typeExercice, Language langue,
                            Map<String, Object> resultatBrut, BigDecimal tauxReussite, Integer dureeSec,
                            boolean interrompu) {
        this.seniorId = seniorId;
        this.dateExercice = dateExercice;
        this.typeExercice = typeExercice;
        this.langue = langue;
        this.resultatBrut = resultatBrut;
        this.tauxReussite = tauxReussite;
        this.dureeSec = dureeSec;
        this.interrompu = interrompu;
    }
}
