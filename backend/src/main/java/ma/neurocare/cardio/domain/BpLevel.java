package ma.neurocare.cardio.domain;

/**
 * Niveau d'alerte d'une mesure de tension (pré-dépistage et orientation, pas un diagnostic), du plus au
 * moins urgent :
 * <ul>
 *   <li>urgence hypertensive : TAS ≥ 180 ou TAD ≥ 110 mmHg ;</li>
 *   <li>hypotension : TAS &lt; 100 mmHg (risque de malaise et de chute) ;</li>
 *   <li>tension élevée (valeurs compatibles avec une HTA modérée) : TAS 135-179 ou TAD 85-109 ;</li>
 *   <li>tension normale : en dessous de 135/85.</li>
 * </ul>
 */
public enum BpLevel {
    URGENCE_HYPERTENSIVE,
    HYPOTENSION,
    TENSION_ELEVEE,
    NORMALE;

    public static final int MIN_TAS = 60;
    public static final int MAX_TAS = 260;
    public static final int MIN_TAD = 30;
    public static final int MAX_TAD = 160;

    public static BpLevel classify(int tas, int tad) {
        if (tas < MIN_TAS || tas > MAX_TAS || tad < MIN_TAD || tad > MAX_TAD || tad >= tas) {
            throw new IllegalArgumentException("Tension invalide (TAS 60-260, TAD 30-160, TAS supérieure à TAD)");
        }
        if (tas >= 180 || tad >= 110) {
            return URGENCE_HYPERTENSIVE;
        }
        if (tas < 100) {
            return HYPOTENSION;
        }
        if (tas >= 135 || tad >= 85) {
            return TENSION_ELEVEE;
        }
        return NORMALE;
    }
}
