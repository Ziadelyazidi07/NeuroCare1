package ma.neurocare.mental.domain;

/**
 * Restitution du questionnaire : indicateurs de pré-dépistage et orientation, jamais un diagnostic.
 * GDS-15 : 0-4, 5-9, 10-15. Une Mini-GDS à 0 arrête le test au premier niveau.
 */
public enum GdsLevel {
    /** Indice normal : absence probable de dépression. */
    INDICE_NORMAL,
    /** Indicateurs compatibles avec une dépression légère à modérée : orientation médecin ou psychologue. */
    LEGERE_A_MODEREE,
    /** Indicateurs compatibles avec une dépression sévère : consultation médicale recommandée. */
    SEVERE;

    public static GdsLevel ofGds15(int points) {
        if (points < 0 || points > 15) {
            throw new IllegalArgumentException("Score GDS-15 hors limites");
        }
        if (points >= 10) {
            return SEVERE;
        }
        return points >= 5 ? LEGERE_A_MODEREE : INDICE_NORMAL;
    }
}
