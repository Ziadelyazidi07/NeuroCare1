package ma.neurocare.mental.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.EnumMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

class GdsResultTest {

    /** Réponses qui ne comptent aucun point (Oui aux items inversés, Non aux autres). */
    private static Map<GdsQuestion, Boolean> reassuring(boolean withComplementary) {
        Map<GdsQuestion, Boolean> answers = new EnumMap<>(GdsQuestion.class);
        GdsQuestion.miniGds().forEach(q -> answers.put(q, q.points(true) == 0));
        if (withComplementary) {
            GdsQuestion.complementary().forEach(q -> answers.put(q, q.points(true) == 0));
        }
        return answers;
    }

    @Test
    void questionnaireHasFourMiniItemsAndFifteenGdsItems() {
        assertThat(GdsQuestion.miniGds()).hasSize(4);
        assertThat(GdsQuestion.gds15()).hasSize(15);
        assertThat(GdsQuestion.complementary()).hasSize(12);
    }

    @Test
    void reversedItemsScoreOnNo() {
        for (GdsQuestion q : new GdsQuestion[] {GdsQuestion.GDS_01, GdsQuestion.GDS_05, GdsQuestion.GDS_07,
                GdsQuestion.GDS_11, GdsQuestion.GDS_13}) {
            assertThat(q.points(false)).as(q.name()).isEqualTo(1);
            assertThat(q.points(true)).as(q.name()).isZero();
        }
        assertThat(GdsQuestion.GDS_03.points(true)).isEqualTo(1);
        assertThat(GdsQuestion.MINI_DECOURAGE.points(true)).isEqualTo(1);
    }

    @Test
    void miniGdsAtZeroStopsTheTest() {
        GdsResult result = GdsResult.evaluate(reassuring(false));
        assertThat(result.miniGdsPoints()).isZero();
        assertThat(result.gds15Points()).isNull();
        assertThat(result.level()).isEqualTo(GdsLevel.INDICE_NORMAL);
    }

    @Test
    void miniGdsAtZeroRefusesComplementaryAnswers() {
        assertThatThrownBy(() -> GdsResult.evaluate(reassuring(true))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void positiveMiniGdsRequiresTheFullGds15() {
        Map<GdsQuestion, Boolean> answers = reassuring(false);
        answers.put(GdsQuestion.MINI_DECOURAGE, true);
        assertThatThrownBy(() -> GdsResult.evaluate(answers)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void gds15ScoreCountsTheFifteenItemsOnly() {
        Map<GdsQuestion, Boolean> answers = reassuring(true);
        answers.put(GdsQuestion.MINI_DECOURAGE, true); // Mini-GDS à 1, sans point GDS-15
        GdsResult none = GdsResult.evaluate(answers);
        assertThat(none.miniGdsPoints()).isEqualTo(1);
        assertThat(none.gds15Points()).isZero();
        assertThat(none.level()).isEqualTo(GdsLevel.INDICE_NORMAL);

        GdsQuestion.gds15().forEach(q -> answers.put(q, q.points(true) == 1));
        GdsResult all = GdsResult.evaluate(answers);
        assertThat(all.miniGdsPoints()).isEqualTo(4);
        assertThat(all.gds15Points()).isEqualTo(15);
        assertThat(all.level()).isEqualTo(GdsLevel.SEVERE);
    }

    @Test
    void levelsFollowTheGds15Bands() {
        assertThat(GdsLevel.ofGds15(4)).isEqualTo(GdsLevel.INDICE_NORMAL);
        assertThat(GdsLevel.ofGds15(5)).isEqualTo(GdsLevel.LEGERE_A_MODEREE);
        assertThat(GdsLevel.ofGds15(9)).isEqualTo(GdsLevel.LEGERE_A_MODEREE);
        assertThat(GdsLevel.ofGds15(10)).isEqualTo(GdsLevel.SEVERE);
    }
}
