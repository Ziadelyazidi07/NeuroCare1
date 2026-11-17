package ma.neurocare.cognitive.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Random;

import ma.neurocare.common.domain.Language;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** EF-CG-01 (tirage) et EF-CG-02 (résultat brut, sans étiquette). */
class WordRecallTest {

    private static final List<String> PRESENTES = List.of("khobz", "bab", "chems");
    private static final List<String> PROPOSITIONS =
            List.of("khobz", "ma", "bab", "kas", "chems", "dar", "zit", "ward", "qmar");

    @ParameterizedTest
    @EnumSource(Language.class)
    void drawGivesRequestedWordsAmongNineDistinctPropositions(Language language) {
        for (int count = WordBank.MIN_WORDS; count <= WordBank.MAX_WORDS; count++) {
            WordBank.Draw draw = WordBank.draw(language, count, new Random(42));

            assertThat(draw.motsPresentes()).hasSize(count).doesNotHaveDuplicates();
            assertThat(draw.propositions()).hasSize(WordBank.PROPOSITIONS).doesNotHaveDuplicates()
                    .containsAll(draw.motsPresentes());
        }
    }

    @Test
    void darijaWordsComeWithArabicScript() {
        assertThat(WordBank.wordsFor(Language.DARIJA)).allSatisfy(w -> assertThat(w.ecritureArabe()).isNotBlank());
        assertThat(WordBank.find(Language.DARIJA, "khobz")).get().extracting(WordBank.Word::ecritureArabe)
                .isEqualTo("خبز");
        assertThat(WordBank.wordsFor(Language.FR)).allSatisfy(w -> assertThat(w.ecritureArabe()).isNull());
        assertThat(new HashSet<>(WordBank.wordsFor(Language.FR))).hasSameSizeAs(WordBank.wordsFor(Language.FR));
    }

    @Test
    void rawResultMatchesCahierExample() {
        // Exemple du cahier §6.4 : 2 mots corrects sur 3.
        WordRecallResult result = new WordRecallResult(PRESENTES, PROPOSITIONS, List.of("khobz", "chems", "dar"),
                60, List.of(3200, 4100, 6900), false);

        assertThat(result.corrects()).isEqualTo(2);
        assertThat(result.tauxReussite()).isEqualByComparingTo(new BigDecimal("66.67"));
        assertThat(result.toRawJson()).containsOnlyKeys(
                "mots_presentes", "propositions", "mots_choisis", "corrects", "delai_rappel_sec", "temps_reponse_ms");
        assertThat(result.toRawJson()).containsEntry("corrects", 2).containsEntry("delai_rappel_sec", 60);
    }

    @Test
    void interruptedExerciseHasNoRateAndNoPenalty() {
        WordRecallResult result = new WordRecallResult(PRESENTES, PROPOSITIONS, List.of("khobz"), 60, null, true);

        assertThat(result.tauxReussite()).isNull();
        assertThat(result.corrects()).isEqualTo(1);
    }

    @Test
    void inconsistentResultsAreRejected() {
        assertThatThrownBy(() -> new WordRecallResult(PRESENTES, PROPOSITIONS, List.of("inconnu"), 60, null, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WordRecallResult(List.of("khobz", "bab"), PROPOSITIONS, List.of(), 60, null, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WordRecallResult(PRESENTES, PROPOSITIONS.subList(0, 8), List.of(), 60, null, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WordRecallResult(PRESENTES, PROPOSITIONS,
                List.of("khobz", "bab", "chems", "dar"), 60, null, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new WordRecallResult(PRESENTES, PROPOSITIONS, List.of("khobz", "khobz"), 60, null, false))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
