package ma.neurocare.mental.domain;

import java.util.Arrays;
import java.util.List;

/**
 * Questions de la Mini-GDS (Clément, 4 questions) et de la GDS-15 (Yesavage, forme courte), posées sur
 * les 7 derniers jours. {@code scoredAnswer} est la réponse qui compte 1 point : « Non » pour les items
 * inversés de la GDS-15 (satisfaction de vie, bonne humeur, heureux, merveilleux de vivre, énergie).
 *
 * <p>Trois questions de la Mini-GDS sont aussi des items de la GDS-15 (vie vide, heureux, situation
 * désespérée) : elles ne sont posées qu'une fois. « Découragé(e) et triste » n'appartient qu'à la Mini-GDS.
 */
public enum GdsQuestion {

    MINI_DECOURAGE("Vous sentez-vous souvent découragé(e) et triste ?", true, true, false),
    GDS_01("Êtes-vous dans l'ensemble satisfait(e) de votre vie ?", false, false, true),
    GDS_02("Avez-vous renoncé à un grand nombre de vos activités et de vos centres d'intérêt ?", true, false, true),
    GDS_03("Avez-vous le sentiment que votre vie est vide ?", true, true, true),
    GDS_04("Vous ennuyez-vous souvent ?", true, false, true),
    GDS_05("Êtes-vous de bonne humeur la plupart du temps ?", false, false, true),
    GDS_06("Avez-vous peur qu'il vous arrive quelque chose de mauvais ?", true, false, true),
    GDS_07("Êtes-vous heureux(se) la plupart du temps ?", false, true, true),
    GDS_08("Vous sentez-vous souvent faible et sans recours ?", true, false, true),
    GDS_09("Préférez-vous rester chez vous plutôt que de sortir et faire de nouvelles choses ?", true, false, true),
    GDS_10("Pensez-vous avoir plus de problèmes de mémoire que la plupart des gens ?", true, false, true),
    GDS_11("Pensez-vous qu'il est merveilleux de vivre à notre époque ?", false, false, true),
    GDS_12("Vous sentez-vous plutôt inutile tel(le) que vous êtes maintenant ?", true, false, true),
    GDS_13("Vous sentez-vous plein(e) d'énergie ?", false, false, true),
    GDS_14("Avez-vous le sentiment que votre situation est désespérée ?", true, true, true),
    GDS_15("Pensez-vous que la situation de la plupart des gens est meilleure que la vôtre ?", true, false, true);

    private final String texte;
    private final boolean scoredAnswer;
    private final boolean miniGds;
    private final boolean gds15;

    GdsQuestion(String texte, boolean scoredAnswer, boolean miniGds, boolean gds15) {
        this.texte = texte;
        this.scoredAnswer = scoredAnswer;
        this.miniGds = miniGds;
        this.gds15 = gds15;
    }

    public String texte() {
        return texte;
    }

    /** 1 point si la réponse donnée est la réponse comptée. */
    public int points(boolean answer) {
        return answer == scoredAnswer ? 1 : 0;
    }

    public static List<GdsQuestion> miniGds() {
        return Arrays.stream(values()).filter(q -> q.miniGds).toList();
    }

    public static List<GdsQuestion> gds15() {
        return Arrays.stream(values()).filter(q -> q.gds15).toList();
    }

    /** Questions de l'étape 2 : items de la GDS-15 pas encore posés pendant la Mini-GDS. */
    public static List<GdsQuestion> complementary() {
        return Arrays.stream(values()).filter(q -> q.gds15 && !q.miniGds).toList();
    }
}
