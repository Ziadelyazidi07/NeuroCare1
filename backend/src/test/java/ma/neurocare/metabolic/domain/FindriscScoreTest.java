package ma.neurocare.metabolic.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class FindriscScoreTest {

    private static FindriscAnswers answers(int age, Sex sexe, double poids, double taille, int tourTaille,
                                           boolean activite, boolean fruits, boolean hta, boolean glycemie,
                                           FamilyHistory famille) {
        return new FindriscAnswers(age, sexe, poids, taille, tourTaille, activite, fruits, hta, glycemie, famille);
    }

    @ParameterizedTest(name = "âge {0} -> {1} pt")
    @CsvSource({"44,0", "45,2", "54,2", "55,3", "64,3", "65,4", "90,4"})
    void agePoints(int age, int points) {
        assertThat(FindriscScore.agePoints(age)).isEqualTo(points);
    }

    @ParameterizedTest(name = "IMC {0} -> {1} pt")
    @CsvSource({"24.9,0", "25.0,1", "30.0,1", "30.1,3"})
    void imcPoints(double imc, int points) {
        assertThat(FindriscScore.imcPoints(imc)).isEqualTo(points);
    }

    @ParameterizedTest(name = "{0} {1} cm -> {2} pt")
    @CsvSource({"HOMME,93,0", "HOMME,94,3", "HOMME,102,3", "HOMME,103,4",
            "FEMME,79,0", "FEMME,80,3", "FEMME,88,3", "FEMME,89,4"})
    void waistPoints(Sex sexe, int cm, int points) {
        assertThat(FindriscScore.waistPoints(sexe, cm)).isEqualTo(points);
    }

    @Test
    void imcIsComputedFromWeightAndHeightAndRounded() {
        assertThat(answers(50, Sex.FEMME, 70, 165, 80, true, true, false, false, FamilyHistory.AUCUN).imc())
                .isEqualTo(25.7);
    }

    @Test
    void lowestAndHighestScores() {
        FindriscScore low = FindriscScore.of(answers(40, Sex.HOMME, 65, 180, 85, true, true, false, false,
                FamilyHistory.AUCUN));
        assertThat(low.total()).isZero();
        assertThat(low.level()).isEqualTo(FindriscLevel.FAIBLE);

        FindriscScore high = FindriscScore.of(answers(70, Sex.FEMME, 95, 160, 100, false, false, true, true,
                FamilyHistory.PROCHES));
        assertThat(high.total()).isEqualTo(FindriscScore.MAX);
        assertThat(high.level()).isEqualTo(FindriscLevel.TRES_ELEVE);
        assertThat(high.details()).hasSize(8);
    }

    @ParameterizedTest(name = "{0} pts -> {1}")
    @CsvSource({"6,FAIBLE", "7,LEGEREMENT_ACCRU", "11,LEGEREMENT_ACCRU", "12,MODERE", "14,MODERE",
            "15,ELEVE", "20,ELEVE", "21,TRES_ELEVE", "26,TRES_ELEVE"})
    void levels(int score, FindriscLevel level) {
        assertThat(FindriscLevel.of(score)).isEqualTo(level);
    }

    @Test
    void tenYearEstimatesFollowTheOfficialTable() {
        assertThat(FindriscLevel.FAIBLE.tenYearPercent()).isEqualTo(1);
        assertThat(FindriscLevel.MODERE.tenYearPercent()).isEqualTo(17);
        assertThat(FindriscLevel.TRES_ELEVE.tenYearPercent()).isEqualTo(50);
    }

    @Test
    void rejectsImpossibleAnswers() {
        assertThatThrownBy(() -> answers(50, Sex.HOMME, 70, 1.75, 90, true, true, false, false, FamilyHistory.AUCUN))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
