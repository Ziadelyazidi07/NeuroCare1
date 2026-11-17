package ma.neurocare.medication.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.util.EnumSet;
import java.util.List;

import org.junit.jupiter.api.Test;

class WeekdayMaskTest {

    @Test
    void mondayIsOneAndSundayIsSixtyFour() {
        assertThat(WeekdayMask.bit(DayOfWeek.MONDAY)).isEqualTo((short) 1);
        assertThat(WeekdayMask.bit(DayOfWeek.SUNDAY)).isEqualTo((short) 64);
    }

    @Test
    void allDaysIs127() {
        assertThat(WeekdayMask.of(EnumSet.allOf(DayOfWeek.class))).isEqualTo(WeekdayMask.ALL_DAYS);
    }

    @Test
    void roundTrip() {
        List<DayOfWeek> days = List.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY);
        short mask = WeekdayMask.of(days);

        assertThat(mask).isEqualTo((short) (1 | 4 | 16));
        assertThat(WeekdayMask.toDays(mask)).containsExactlyInAnyOrderElementsOf(days);
        assertThat(WeekdayMask.contains(mask, DayOfWeek.TUESDAY)).isFalse();
    }

    @Test
    void rejectsEmptyAndOutOfRange() {
        assertThatThrownBy(() -> WeekdayMask.of(List.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> WeekdayMask.toDays((short) 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> WeekdayMask.toDays((short) 128)).isInstanceOf(IllegalArgumentException.class);
    }
}
