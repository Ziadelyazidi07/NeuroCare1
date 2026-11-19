package ma.neurocare.mental.domain;

import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cotation d'une passation : Mini-GDS (étape 1), puis GDS-15 seulement si la Mini-GDS vaut au moins 1.
 * Le barème est recalculé ici à partir des réponses ; celui affiché par l'application n'est jamais repris.
 *
 * @param gds15Points {@code null} quand le test s'arrête après une Mini-GDS à 0
 */
public record GdsResult(Map<GdsQuestion, Boolean> answers, int miniGdsPoints, Integer gds15Points, GdsLevel level) {

    public static GdsResult evaluate(Map<GdsQuestion, Boolean> answers) {
        Map<GdsQuestion, Boolean> copy = new EnumMap<>(GdsQuestion.class);
        copy.putAll(answers);
        if (copy.containsValue(null)) {
            throw new IllegalArgumentException("Réponse manquante");
        }
        requireAll(copy, GdsQuestion.miniGds(), "Les 4 questions de la Mini-GDS sont obligatoires");
        int mini = sum(copy, GdsQuestion.miniGds());

        if (mini == 0) {
            Set<GdsQuestion> extra = new HashSet<>(copy.keySet());
            GdsQuestion.miniGds().forEach(extra::remove);
            if (!extra.isEmpty()) {
                throw new IllegalArgumentException("Mini-GDS à 0 : le questionnaire s'arrête après 4 questions");
            }
            return new GdsResult(Map.copyOf(copy), 0, null, GdsLevel.INDICE_NORMAL);
        }
        requireAll(copy, GdsQuestion.complementary(), "Les 15 questions de la GDS-15 sont obligatoires");
        int gds = sum(copy, GdsQuestion.gds15());
        return new GdsResult(Map.copyOf(copy), mini, gds, GdsLevel.ofGds15(gds));
    }

    private static void requireAll(Map<GdsQuestion, Boolean> answers, List<GdsQuestion> questions, String message) {
        if (!answers.keySet().containsAll(questions)) {
            throw new IllegalArgumentException(message);
        }
    }

    private static int sum(Map<GdsQuestion, Boolean> answers, List<GdsQuestion> questions) {
        return questions.stream().mapToInt(q -> q.points(answers.get(q))).sum();
    }
}
