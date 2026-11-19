package ma.neurocare.saturation.domain;

/**
 * Niveau d'alerte d'une mesure de SpO2 au repos, selon le profil respiratoire (outil de pré-dépistage
 * et d'orientation, pas un diagnostic).
 *
 * <ul>
 *   <li>Profil standard : 95-100 % vert, 90-94 % orange, moins de 90 % rouge.</li>
 *   <li>Maladie respiratoire chronique (BPCO, insuffisance respiratoire) : cible 88-92 % verte,
 *       moins de 85 % rouge, orange ailleurs (85-87 % ou au-dessus de 92 %).</li>
 * </ul>
 */
public enum Spo2Level {
    VERT,
    ORANGE,
    ROUGE;

    public static final int MIN_SPO2 = 50;
    public static final int MAX_SPO2 = 100;

    public static Spo2Level classify(int spo2, boolean chronicRespiratoryDisease) {
        if (spo2 < MIN_SPO2 || spo2 > MAX_SPO2) {
            throw new IllegalArgumentException("SpO2 hors limites (" + MIN_SPO2 + " à " + MAX_SPO2 + " %)");
        }
        if (chronicRespiratoryDisease) {
            if (spo2 < 85) {
                return ROUGE;
            }
            return spo2 >= 88 && spo2 <= 92 ? VERT : ORANGE;
        }
        if (spo2 < 90) {
            return ROUGE;
        }
        return spo2 >= 95 ? VERT : ORANGE;
    }
}
