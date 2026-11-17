package ma.neurocare.reminder.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;

import ma.neurocare.medication.domain.WeekdayMask;
import ma.neurocare.reminder.domain.DoseScheduleCalculator.Slot;
import org.junit.jupiter.api.Test;

/** Calcul des horaires : fuseau du senior, masque des jours, bornes de dates, heure d'été. */
class DoseScheduleCalculatorTest {

    /**
     * Fuseau aux règles fixes (UTC+1, sans heure d'été) : le test vérifie le calcul, pas la base tzdata.
     * Les règles d'Africa/Casablanca changent selon les versions de tzdata (UTC+1 en 2025b, UTC+0 en 2026e
     * pour novembre 2026) : un décalage codé en dur rendrait le test dépendant du JDK.
     */
    private static final ZoneId SENIOR_ZONE = ZoneId.of("Africa/Lagos");
    private static final LocalDate TUESDAY = LocalDate.of(2026, 11, 17);

    @Test
    void localTimeIsConvertedWithSeniorZone() {
        Slot slot = new Slot(LocalTime.of(8, 0), WeekdayMask.ALL_DAYS, TUESDAY, null);

        // Fuseau du senior en UTC+1.
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY, SENIOR_ZONE))
                .contains(Instant.parse("2026-11-17T07:00:00Z"));
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY, ZoneId.of("UTC")))
                .contains(Instant.parse("2026-11-17T08:00:00Z"));
    }

    @Test
    void dayExcludedByMaskHasNoOccurrence() {
        short mondayWednesday = WeekdayMask.of(EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY));
        Slot slot = new Slot(LocalTime.of(20, 0), mondayWednesday, TUESDAY.minusDays(7), null);

        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY, SENIOR_ZONE)).isEmpty();
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY.plusDays(1), SENIOR_ZONE)).isPresent();
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY.minusDays(1), SENIOR_ZONE)).isPresent();
    }

    @Test
    void startAndEndDatesAreInclusive() {
        Slot slot = new Slot(LocalTime.of(9, 0), WeekdayMask.ALL_DAYS, TUESDAY, TUESDAY.plusDays(2));

        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY.minusDays(1), SENIOR_ZONE)).isEmpty();
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY, SENIOR_ZONE)).isPresent();
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY.plusDays(2), SENIOR_ZONE)).isPresent();
        assertThat(DoseScheduleCalculator.occurrenceOn(slot, TUESDAY.plusDays(3), SENIOR_ZONE)).isEmpty();
    }

    @Test
    void windowSkipsOccurrencesBeforeNotBefore() {
        Slot slot = new Slot(LocalTime.of(8, 0), WeekdayMask.ALL_DAYS, TUESDAY, null);
        // Traitement créé à 10:00 locales : la prise de 08:00 du jour n'est pas générée rétroactivement.
        Instant tenAm = Instant.parse("2026-11-17T09:00:00Z");

        List<Instant> occurrences = DoseScheduleCalculator.occurrences(slot, TUESDAY, 3, SENIOR_ZONE, tenAm);

        assertThat(occurrences).containsExactly(
                Instant.parse("2026-11-18T07:00:00Z"),
                Instant.parse("2026-11-19T07:00:00Z"));
    }

    @Test
    void windowWithoutLowerBoundKeepsWholeFirstDay() {
        Slot slot = new Slot(LocalTime.of(0, 0), WeekdayMask.ALL_DAYS, TUESDAY, null);

        assertThat(DoseScheduleCalculator.occurrences(slot, TUESDAY, 2, SENIOR_ZONE, null)).hasSize(2);
    }

    @Test
    void timeInsideDaylightSavingGapIsShiftedForward() {
        ZoneId paris = ZoneId.of("Europe/Paris");
        LocalDate springForward = LocalDate.of(2026, 3, 29); // 02:00 → 03:00
        Slot slot = new Slot(LocalTime.of(2, 30), WeekdayMask.ALL_DAYS, springForward, null);

        assertThat(DoseScheduleCalculator.occurrenceOn(slot, springForward, paris))
                .contains(Instant.parse("2026-03-29T01:30:00Z")); // 03:30 heure d'été
    }
}
