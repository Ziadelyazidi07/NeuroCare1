package ma.neurocare.cardio.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Moyenne des mesures d'un protocole d'automesure (3 jours × matin et soir × 3 mesures = 18). Une moyenne
 * ≥ 135/85 mmHg invite à montrer le relevé au médecin.
 */
public record BpAverage(BigDecimal tas, BigDecimal tad, BigDecimal pouls, int count) {

    public static final int PROTOCOL_SIZE = 18;
    public static final int TAS_THRESHOLD = 135;
    public static final int TAD_THRESHOLD = 85;

    public static BpAverage of(List<BpMeasurement> measures) {
        if (measures.isEmpty()) {
            return new BpAverage(null, null, null, 0);
        }
        return new BpAverage(mean(measures.stream().mapToInt(BpMeasurement::getTas).sum(), measures.size()),
                mean(measures.stream().mapToInt(BpMeasurement::getTad).sum(), measures.size()),
                mean(measures.stream().mapToInt(BpMeasurement::getPouls).sum(), measures.size()),
                measures.size());
    }

    private static BigDecimal mean(int sum, int count) {
        return BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP);
    }

    public boolean complete() {
        return count == PROTOCOL_SIZE;
    }

    /** Moyenne ≥ 135/85 (évaluée sur les mesures disponibles). */
    public boolean elevated() {
        return count > 0 && (tas.compareTo(BigDecimal.valueOf(TAS_THRESHOLD)) >= 0
                || tad.compareTo(BigDecimal.valueOf(TAD_THRESHOLD)) >= 0);
    }
}
