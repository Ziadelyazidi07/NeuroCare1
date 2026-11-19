package ma.neurocare.metabolic.domain;

/** Antécédents familiaux de diabète (question 8 du FINDRISC). */
public enum FamilyHistory {
    /** Aucun : 0 point. */
    AUCUN(0),
    /** Grand-parent, tante, oncle ou cousin germain : 3 points. */
    ELOIGNES(3),
    /** Parent, frère, sœur ou enfant : 5 points. */
    PROCHES(5);

    private final int points;

    FamilyHistory(int points) {
        this.points = points;
    }

    public int points() {
        return points;
    }
}
