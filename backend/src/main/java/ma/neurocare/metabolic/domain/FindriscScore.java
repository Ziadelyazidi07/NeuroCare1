package ma.neurocare.metabolic.domain;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Cotation officielle du FINDRISC sur 26 points (Lindström et Tuomilehto). Le barème est recalculé ici à
 * partir des réponses ; celui affiché par l'application n'est jamais repris.
 */
public record FindriscScore(int age, int imc, int tourTaille, int activitePhysique, int fruitsLegumes,
                            int medicamentsHypertension, int glycemieElevee, int antecedentsFamiliaux) {

    public static final int MAX = 26;

    public static FindriscScore of(FindriscAnswers a) {
        return new FindriscScore(agePoints(a.age()), imcPoints(a.imc()), waistPoints(a.sexe(), a.tourTailleCm()),
                a.activitePhysique() ? 0 : 2, a.fruitsLegumesQuotidiens() ? 0 : 1,
                a.medicamentsHypertension() ? 2 : 0, a.glycemieEleveeAntecedent() ? 5 : 0,
                a.antecedentsFamiliaux().points());
    }

    static int agePoints(int age) {
        if (age < 45) {
            return 0;
        }
        if (age <= 54) {
            return 2;
        }
        return age <= 64 ? 3 : 4;
    }

    static int imcPoints(double imc) {
        if (imc < 25) {
            return 0;
        }
        return imc <= 30 ? 1 : 3;
    }

    static int waistPoints(Sex sexe, int cm) {
        int low = sexe == Sex.HOMME ? 94 : 80;
        int high = sexe == Sex.HOMME ? 102 : 88;
        if (cm < low) {
            return 0;
        }
        return cm <= high ? 3 : 4;
    }

    public int total() {
        return age + imc + tourTaille + activitePhysique + fruitsLegumes + medicamentsHypertension + glycemieElevee
                + antecedentsFamiliaux;
    }

    public FindriscLevel level() {
        return FindriscLevel.of(total());
    }

    /** Détail par question, dans l'ordre du questionnaire. */
    public Map<String, Integer> details() {
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put("age", age);
        map.put("imc", imc);
        map.put("tourTaille", tourTaille);
        map.put("activitePhysique", activitePhysique);
        map.put("fruitsLegumes", fruitsLegumes);
        map.put("medicamentsHypertension", medicamentsHypertension);
        map.put("glycemieElevee", glycemieElevee);
        map.put("antecedentsFamiliaux", antecedentsFamiliaux);
        return map;
    }
}
