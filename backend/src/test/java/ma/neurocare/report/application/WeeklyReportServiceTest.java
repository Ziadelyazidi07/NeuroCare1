package ma.neurocare.report.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionDto;
import ma.neurocare.cognitive.domain.ExerciseType;
import ma.neurocare.common.domain.Language;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.medication.api.dto.MedicationDtos.HoraireDto;
import ma.neurocare.medication.domain.JourSemaine;
import ma.neurocare.reminder.api.dto.DoseDtos.DoseDto;
import ma.neurocare.reminder.domain.DoseStatus;
import org.junit.jupiter.api.Test;

/** Agrégats du rapport (cahier §11.1) : totaux, délai médian, évolution brute, validation de la semaine. */
class WeeklyReportServiceTest {

    private static final Instant T = Instant.parse("2026-11-17T07:00:00Z");

    @Test
    void totalsPerTreatmentAndMedianConfirmationDelay() {
        List<DoseDto> doses = List.of(
                dose("Metformine 500", DoseStatus.CONFIRME, 2),
                dose("Metformine 500", DoseStatus.CONFIRME, 10),
                dose("Metformine 500", DoseStatus.CONFIRME, 4),
                dose("Metformine 500", DoseStatus.SANS_REPONSE, null),
                dose("Metformine 500", DoseStatus.DESACTIVE, null),
                dose("Amlodipine 5", DoseStatus.CONFIRME, 1),
                dose("Amlodipine 5", DoseStatus.CONFIRME, 6),
                dose("Amlodipine 5", DoseStatus.EN_ATTENTE, null));

        List<WeeklyReport.TreatmentTotals> totals = WeeklyReportService.totals(doses);

        assertThat(totals).extracting(WeeklyReport.TreatmentTotals::traitement).containsExactly("Amlodipine 5", "Metformine 500");
        WeeklyReport.TreatmentTotals metformine = totals.get(1);
        assertThat(metformine.confirmees()).isEqualTo(3);
        assertThat(metformine.sansReponse()).isEqualTo(1);
        assertThat(metformine.desactivees()).isEqualTo(1);
        assertThat(metformine.delaiMedianMinutes()).isEqualTo(4L);       // médiane de 2, 4, 10
        assertThat(totals.get(0).delaiMedianMinutes()).isEqualTo(4L);    // (1 + 6) / 2 arrondi
        assertThat(totals.get(0).enAttente()).isEqualTo(1);
    }

    @Test
    void earlyConfirmationCountsAsZeroDelayAndNoConfirmationGivesNoMedian() {
        assertThat(WeeklyReportService.medianConfirmationDelay(List.of(dose("X", DoseStatus.CONFIRME, -5)))).isZero();
        assertThat(WeeklyReportService.medianConfirmationDelay(List.of(dose("X", DoseStatus.SANS_REPONSE, null))))
                .isNull();
    }

    @Test
    void evolutionAveragesOnlyCompletedExercises() {
        List<SessionDto> sessions = List.of(
                session("66.67", false), session("100.00", false), session(null, true));

        assertThat(WeeklyReportService.meanRate(sessions)).isEqualByComparingTo(new BigDecimal("83.3"));
        assertThat(WeeklyReportService.meanRate(List.of(session(null, true)))).isNull();
        assertThat(WeeklyReportService.meanRate(List.of())).isNull();
    }

    @Test
    void weekMustStartOnAMondayThatHasBegun() {
        LocalDate today = LocalDate.of(2026, 11, 17);
        WeeklyReportService.validate(LocalDate.of(2026, 11, 16), null, today);

        assertThatThrownBy(() -> WeeklyReportService.validate(LocalDate.of(2026, 11, 17), null, today))
                .isInstanceOf(BusinessException.class).hasMessageContaining("lundi");
        assertThatThrownBy(() -> WeeklyReportService.validate(LocalDate.of(2026, 11, 23), null, today))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> WeeklyReportService.validate(LocalDate.of(2026, 11, 16), "x".repeat(1001), today))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void ageIsComputedFromBirthYearOnly() {
        assertThat(WeeklyReportService.age((short) 1952, LocalDate.of(2026, 11, 22))).isEqualTo(74);
        assertThat(WeeklyReportService.age(null, LocalDate.of(2026, 11, 22))).isNull();
    }

    @Test
    void schedulesAreReadable() {
        String text = WeeklyReportService.schedules(List.of(
                new HoraireDto(UUID.randomUUID(), LocalTime.of(8, 0), List.of(JourSemaine.values())),
                new HoraireDto(UUID.randomUUID(), LocalTime.of(20, 30), List.of(JourSemaine.LUN, JourSemaine.JEU))));

        assertThat(text).isEqualTo("08:00 (tous les jours) ; 20:30 (LUN, JEU)");
    }

    private static DoseDto dose(String name, DoseStatus status, Integer delayMinutes) {
        return new DoseDto(UUID.randomUUID(), UUID.nameUUIDFromBytes(name.getBytes()), name, null, T, status,
                delayMinutes == null ? null : T.plusSeconds(delayMinutes * 60L));
    }

    private static SessionDto session(String rate, boolean interrupted) {
        return new SessionDto(UUID.randomUUID(), T, ExerciseType.RAPPEL_MOTS, Language.DARIJA, 3, 2,
                rate == null ? null : new BigDecimal(rate), 90, interrupted, java.util.Map.of());
    }
}
