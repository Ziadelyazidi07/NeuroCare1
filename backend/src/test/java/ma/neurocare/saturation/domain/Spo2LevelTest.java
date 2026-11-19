package ma.neurocare.saturation.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class Spo2LevelTest {

    @ParameterizedTest(name = "standard {0} % -> {1}")
    @CsvSource({"100,VERT", "95,VERT", "94,ORANGE", "90,ORANGE", "89,ROUGE", "70,ROUGE"})
    void standardProfile(int spo2, Spo2Level expected) {
        assertThat(Spo2Level.classify(spo2, false)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "BPCO {0} % -> {1}")
    @CsvSource({"96,ORANGE", "93,ORANGE", "92,VERT", "88,VERT", "87,ORANGE", "85,ORANGE", "84,ROUGE"})
    void chronicRespiratoryProfile(int spo2, Spo2Level expected) {
        assertThat(Spo2Level.classify(spo2, true)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({"49", "101"})
    void rejectsImpossibleValues(int spo2) {
        assertThatThrownBy(() -> Spo2Level.classify(spo2, false)).isInstanceOf(IllegalArgumentException.class);
    }
}
