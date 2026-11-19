package ma.neurocare.metabolic.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Passation FINDRISC (table {@code findrisc_assessments}). */
@Entity
@Table(name = "findrisc_assessments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FindriscAssessment extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "date_passation", nullable = false, updatable = false)
    private Instant datePassation;

    @Column(name = "age", nullable = false, updatable = false)
    private short age;

    @Enumerated(EnumType.STRING)
    @Column(name = "sexe", nullable = false, length = 10, updatable = false)
    private Sex sexe;

    @Column(name = "poids_kg", nullable = false, precision = 5, scale = 1, updatable = false)
    private BigDecimal poidsKg;

    @Column(name = "taille_cm", nullable = false, precision = 5, scale = 1, updatable = false)
    private BigDecimal tailleCm;

    @Column(name = "imc", nullable = false, precision = 4, scale = 1, updatable = false)
    private BigDecimal imc;

    @Column(name = "tour_taille_cm", nullable = false, updatable = false)
    private short tourTailleCm;

    @Column(name = "activite_physique", nullable = false, updatable = false)
    private boolean activitePhysique;

    @Column(name = "fruits_legumes_quotidiens", nullable = false, updatable = false)
    private boolean fruitsLegumesQuotidiens;

    @Column(name = "medicaments_hypertension", nullable = false, updatable = false)
    private boolean medicamentsHypertension;

    @Column(name = "glycemie_elevee_antecedent", nullable = false, updatable = false)
    private boolean glycemieEleveeAntecedent;

    @Enumerated(EnumType.STRING)
    @Column(name = "antecedents_familiaux", nullable = false, length = 20, updatable = false)
    private FamilyHistory antecedentsFamiliaux;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "points", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Integer> points;

    @Column(name = "score_total", nullable = false, updatable = false)
    private short scoreTotal;

    @Enumerated(EnumType.STRING)
    @Column(name = "niveau", nullable = false, length = 30, updatable = false)
    private FindriscLevel niveau;

    @Column(name = "saisi_par", updatable = false)
    private UUID saisiPar;

    public FindriscAssessment(UUID seniorId, Instant datePassation, FindriscAnswers answers, UUID saisiPar) {
        FindriscScore score = FindriscScore.of(answers);
        this.seniorId = seniorId;
        this.datePassation = datePassation;
        this.age = (short) answers.age();
        this.sexe = answers.sexe();
        this.poidsKg = oneDecimal(answers.poidsKg());
        this.tailleCm = oneDecimal(answers.tailleCm());
        this.imc = oneDecimal(answers.imc());
        this.tourTailleCm = (short) answers.tourTailleCm();
        this.activitePhysique = answers.activitePhysique();
        this.fruitsLegumesQuotidiens = answers.fruitsLegumesQuotidiens();
        this.medicamentsHypertension = answers.medicamentsHypertension();
        this.glycemieEleveeAntecedent = answers.glycemieEleveeAntecedent();
        this.antecedentsFamiliaux = answers.antecedentsFamiliaux();
        this.points = score.details();
        this.scoreTotal = (short) score.total();
        this.niveau = score.level();
        this.saisiPar = saisiPar;
    }

    private static BigDecimal oneDecimal(double value) {
        return BigDecimal.valueOf(value).setScale(1, RoundingMode.HALF_UP);
    }
}
