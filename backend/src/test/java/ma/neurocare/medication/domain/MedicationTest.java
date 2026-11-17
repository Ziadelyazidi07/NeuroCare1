package ma.neurocare.medication.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Horaires d'un traitement : un horaire retiré est désactivé, jamais supprimé (historique conservé). */
class MedicationTest {

    private static final LocalTime EIGHT = LocalTime.of(8, 0);
    private static final LocalTime TWENTY = LocalTime.of(20, 0);
    private static final Set<DayOfWeek> EVERY_DAY = EnumSet.allOf(DayOfWeek.class);

    private final Medication medication = new Medication(UUID.randomUUID(), "Metformine 500",
            "1 comprimé pendant le repas", LocalDate.of(2026, 11, 17), null, UUID.randomUUID());

    @Test
    void schedulesAreCreatedWithDayMask() {
        medication.replaceSchedules(Map.of(EIGHT, EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.SUNDAY)));

        MedicationSchedule schedule = medication.activeSchedules().getFirst();
        assertThat(schedule.getJoursSemaine()).isEqualTo((short) (1 | 64));
        assertThat(schedule.appliesOn(DayOfWeek.SUNDAY)).isTrue();
        assertThat(schedule.appliesOn(DayOfWeek.TUESDAY)).isFalse();
    }

    @Test
    void replacingKeepsSameTimeDeactivatesRemovedAndAddsNew() {
        medication.replaceSchedules(ordered(EIGHT, EVERY_DAY, TWENTY, EVERY_DAY));
        MedicationSchedule eight = scheduleAt(EIGHT);

        medication.replaceSchedules(ordered(EIGHT, EnumSet.of(DayOfWeek.FRIDAY), LocalTime.of(13, 0), EVERY_DAY));

        assertThat(scheduleAt(EIGHT)).isSameAs(eight);
        assertThat(eight.getJoursSemaine()).isEqualTo(WeekdayMask.bit(DayOfWeek.FRIDAY));
        assertThat(scheduleAt(TWENTY).isActif()).isFalse();
        assertThat(medication.getHoraires()).hasSize(3);
        assertThat(medication.activeSchedules()).extracting(MedicationSchedule::getHeureRappel)
                .containsExactlyInAnyOrder(EIGHT, LocalTime.of(13, 0));
    }

    @Test
    void readdingARemovedTimeReactivatesTheSameSchedule() {
        medication.replaceSchedules(Map.of(TWENTY, EVERY_DAY));
        MedicationSchedule twenty = scheduleAt(TWENTY);
        medication.replaceSchedules(Map.of(EIGHT, EVERY_DAY));

        medication.replaceSchedules(Map.of(TWENTY, EVERY_DAY));

        assertThat(scheduleAt(TWENTY)).isSameAs(twenty);
        assertThat(twenty.isActif()).isTrue();
        assertThat(scheduleAt(EIGHT).isActif()).isFalse();
    }

    @Test
    void endDateBeforeStartDateIsRejected() {
        assertThatThrownBy(() -> medication.describe("X", null, LocalDate.of(2026, 11, 17),
                LocalDate.of(2026, 11, 16))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void jourSemaineMapsToMaskBothWays() {
        short mask = WeekdayMask.of(JourSemaine.toDaysOfWeek(List.of(JourSemaine.LUN, JourSemaine.DIM)));

        assertThat(mask).isEqualTo((short) 65);
        assertThat(JourSemaine.fromMask(mask)).containsExactly(JourSemaine.LUN, JourSemaine.DIM);
        assertThat(JourSemaine.fromMask(WeekdayMask.ALL_DAYS)).hasSize(7);
    }

    private MedicationSchedule scheduleAt(LocalTime time) {
        return medication.getHoraires().stream().filter(s -> s.getHeureRappel().equals(time)).findFirst()
                .orElseThrow();
    }

    private static Map<LocalTime, Set<DayOfWeek>> ordered(LocalTime t1, Set<DayOfWeek> d1, LocalTime t2,
                                                          Set<DayOfWeek> d2) {
        Map<LocalTime, Set<DayOfWeek>> map = new LinkedHashMap<>();
        map.put(t1, d1);
        map.put(t2, d2);
        return map;
    }
}
