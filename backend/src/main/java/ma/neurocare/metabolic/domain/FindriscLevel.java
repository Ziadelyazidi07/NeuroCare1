package ma.neurocare.metabolic.domain;

/**
 * Restitution officielle du FINDRISC (risque estimé de diabète de type 2 à 10 ans). Indicateur de
 * pré-dépistage et d'orientation, jamais un diagnostic.
 */
public enum FindriscLevel {
    /** Moins de 7 points : environ 1 % à 10 ans. */
    FAIBLE(1),
    /** 7 à 11 points : environ 4 %. */
    LEGEREMENT_ACCRU(4),
    /** 12 à 14 points : environ 17 %, en parler au médecin. */
    MODERE(17),
    /** 15 à 20 points : environ 33 %, bilan sanguin recommandé. */
    ELEVE(33),
    /** Plus de 20 points : environ 50 %, consultation médicale / endocrinologue fortement recommandée. */
    TRES_ELEVE(50);

    private final int tenYearPercent;

    FindriscLevel(int tenYearPercent) {
        this.tenYearPercent = tenYearPercent;
    }

    public int tenYearPercent() {
        return tenYearPercent;
    }

    public static FindriscLevel of(int score) {
        if (score < 0 || score > FindriscScore.MAX) {
            throw new IllegalArgumentException("Score FINDRISC hors limites");
        }
        if (score > 20) {
            return TRES_ELEVE;
        }
        if (score >= 15) {
            return ELEVE;
        }
        if (score >= 12) {
            return MODERE;
        }
        return score >= 7 ? LEGEREMENT_ACCRU : FAIBLE;
    }
}
