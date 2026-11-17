package ma.neurocare.reminder.domain;

/**
 * Type PostgreSQL {@code dose_status}. CONFIRME, SANS_REPONSE et DESACTIVE sont finaux (cahier §9.1).
 * SANS_REPONSE ne signifie ni « oubli » ni « non-prise ».
 */
public enum DoseStatus {
    EN_ATTENTE,
    CONFIRME,
    SANS_REPONSE,
    DESACTIVE;

    public boolean isFinal() {
        return this != EN_ATTENTE;
    }

    /** Pastille du tableau de bord (EF-DA-01) : vert, orange, gris. */
    public String couleur() {
        return switch (this) {
            case CONFIRME -> "VERT";
            case SANS_REPONSE -> "ORANGE";
            case EN_ATTENTE, DESACTIVE -> "GRIS";
        };
    }
}
