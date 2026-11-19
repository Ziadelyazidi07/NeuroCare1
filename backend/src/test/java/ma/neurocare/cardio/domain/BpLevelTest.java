package ma.neurocare.cardio.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BpLevelTest {

    @ParameterizedTest(name = "{0}/{1} -> {2}")
    @CsvSource({
            "180,90,URGENCE_HYPERTENSIVE", "150,110,URGENCE_HYPERTENSIVE",
            "179,109,TENSION_ELEVEE", "135,70,TENSION_ELEVEE", "120,85,TENSION_ELEVEE",
            "134,84,NORMALE", "100,60,NORMALE",
            "99,60,HYPOTENSION", "85,50,HYPOTENSION"})
    void classify(int tas, int tad, BpLevel level) {
        assertThat(BpLevel.classify(tas, tad)).isEqualTo(level);
    }

    @Test
    void rejectsImpossibleValues() {
        assertThatThrownBy(() -> BpLevel.classify(80, 90)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BpLevel.classify(300, 90)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void averageOfEighteenMeasuresComparesTo135Over85() {
        UUID senior = UUID.randomUUID();
        List<BpMeasurement> normal = java.util.stream.IntStream.range(0, 18)
                .mapToObj(i -> new BpMeasurement(senior, Instant.EPOCH, i % 2 == 0 ? 130 : 138, 80, 70, null, null))
                .toList();
        BpAverage avg = BpAverage.of(normal);
        assertThat(avg.complete()).isTrue();
        assertThat(avg.tas()).isEqualByComparingTo(new BigDecimal("134.0"));
        assertThat(avg.elevated()).isFalse();

        List<BpMeasurement> high = java.util.stream.IntStream.range(0, 18)
                .mapToObj(i -> new BpMeasurement(senior, Instant.EPOCH, 128, 86, 70, null, null)).toList();
        assertThat(BpAverage.of(high).elevated()).isTrue();
        assertThat(BpAverage.of(List.of()).elevated()).isFalse();
    }
}
