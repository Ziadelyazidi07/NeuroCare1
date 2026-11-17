package ma.neurocare.report.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionDto;
import ma.neurocare.cognitive.application.CognitiveService;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.medication.api.dto.MedicationDtos.HoraireDto;
import ma.neurocare.medication.api.dto.MedicationDtos.MedicationDto;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.medication.domain.JourSemaine;
import ma.neurocare.reminder.api.dto.DoseDtos.DoseDto;
import ma.neurocare.reminder.application.DoseService;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.report.application.WeeklyReport.DoseLine;
import ma.neurocare.report.application.WeeklyReport.ExerciseEvolution;
import ma.neurocare.report.application.WeeklyReport.ExerciseLine;
import ma.neurocare.report.application.WeeklyReport.TreatmentLine;
import ma.neurocare.report.application.WeeklyReport.TreatmentTotals;
import ma.neurocare.user.application.SeniorReportProfile;
import ma.neurocare.user.application.SeniorService;
import ma.neurocare.user.application.UserService;
import org.springframework.stereotype.Service;

/**
 * Agrège 7 jours de données en un {@link WeeklyReport} (cahier §11.2). Le PDF est produit à la demande
 * et n'est jamais stocké côté serveur. L'autorisation et l'audit EXPORT_PDF sont appliqués par le contrôleur.
 */
@Service
@RequiredArgsConstructor
public class WeeklyReportService {

    static final int MAX_OBSERVATIONS = 1000;
    private static final int PREVIOUS_WEEKS = 4;

    private final SeniorService seniorService;
    private final UserService userService;
    private final MedicationService medicationService;
    private final DoseService doseService;
    private final CognitiveService cognitiveService;
    private final Clock clock;

    public WeeklyReport build(UUID seniorId, LocalDate weekStart, String observations, UUID aidantId) {
        SeniorReportProfile senior = seniorService.reportProfile(seniorId);
        ZoneId zone = senior.zone();
        validate(weekStart, observations, LocalDate.now(clock.withZone(zone)));
        LocalDate weekEnd = weekStart.plusDays(6);

        List<DoseDto> doses = doseService.dosesBetween(seniorId, weekStart, weekEnd);
        List<SessionDto> week = cognitiveService.history(seniorId, startOf(weekStart, zone),
                startOf(weekEnd.plusDays(1), zone)).sessions();
        List<SessionDto> previous = cognitiveService.history(seniorId,
                startOf(weekStart.minusWeeks(PREVIOUS_WEEKS), zone), startOf(weekStart, zone)).sessions();

        return new WeeklyReport(
                senior.nomComplet(),
                age(senior.anneeNaissance(), weekEnd),
                weekStart,
                weekEnd,
                "%d-W%02d".formatted(weekStart.get(IsoFields.WEEK_BASED_YEAR),
                        weekStart.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)),
                userService.getActiveAccount(aidantId).nomComplet(),
                clock.instant(),
                zone,
                senior.donneesFictives(),
                treatments(seniorId, doses),
                doses.stream().map(d -> doseLine(d, zone)).toList(),
                totals(doses),
                week.stream().map(s -> exerciseLine(s, zone)).toList(),
                new ExerciseEvolution(week.size(), meanRate(week), previous.size(), meanRate(previous)),
                observations == null || observations.isBlank() ? null : observations.strip());
    }

    /** Nom du fichier : {@code neurocare-rapport-2026-W47.pdf} (cahier §11.2). */
    public static String fileName(WeeklyReport report) {
        return "neurocare-rapport-" + report.semaineIso() + ".pdf";
    }

    // ---------- Calculs ----------

    static void validate(LocalDate weekStart, String observations, LocalDate today) {
        if (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "weekStart doit être un lundi.");
        }
        if (weekStart.isAfter(today)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "La semaine demandée n'a pas commencé.");
        }
        if (observations != null && observations.length() > MAX_OBSERVATIONS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Observations limitées à 1000 caractères.");
        }
    }

    static Integer age(Short birthYear, LocalDate at) {
        return birthYear == null ? null : at.getYear() - birthYear;
    }

    /** Traitements actifs, plus ceux présents dans la semaine mais désactivés depuis. */
    private List<TreatmentLine> treatments(UUID seniorId, List<DoseDto> doses) {
        List<TreatmentLine> lines = new ArrayList<>();
        List<MedicationDto> active = medicationService.listActive(seniorId);
        Set<UUID> activeIds = active.stream().map(MedicationDto::id).collect(Collectors.toSet());
        for (MedicationDto m : active) {
            lines.add(new TreatmentLine(m.nomMedicament(), m.consigne(), schedules(m.horaires()), true));
        }
        doses.stream()
                .filter(d -> d.medicationId() != null && !activeIds.contains(d.medicationId()))
                .collect(Collectors.toMap(DoseDto::medicationId, d -> d, (a, b) -> a, LinkedHashMap::new))
                .values()
                .forEach(d -> lines.add(new TreatmentLine(d.nomMedicament(), d.consigne(), "—", false)));
        return lines;
    }

    static String schedules(List<HoraireDto> horaires) {
        return horaires.stream()
                .map(h -> "%02d:%02d %s".formatted(h.heure().getHour(), h.heure().getMinute(), days(h.jours())))
                .collect(Collectors.joining(" ; "));
    }

    private static String days(List<JourSemaine> jours) {
        return jours.size() == 7 ? "(tous les jours)"
                : jours.stream().map(Enum::name).collect(Collectors.joining(", ", "(", ")"));
    }

    static List<TreatmentTotals> totals(List<DoseDto> doses) {
        Map<String, List<DoseDto>> byTreatment = doses.stream()
                .collect(Collectors.groupingBy(d -> Objects.requireNonNullElse(d.nomMedicament(), "—"),
                        LinkedHashMap::new, Collectors.toList()));
        return byTreatment.entrySet().stream()
                .map(e -> new TreatmentTotals(e.getKey(),
                        count(e.getValue(), DoseStatus.CONFIRME),
                        count(e.getValue(), DoseStatus.SANS_REPONSE),
                        count(e.getValue(), DoseStatus.DESACTIVE),
                        count(e.getValue(), DoseStatus.EN_ATTENTE),
                        medianConfirmationDelay(e.getValue())))
                .sorted(Comparator.comparing(TreatmentTotals::traitement))
                .toList();
    }

    /** Délai médian (minutes) entre l'heure prévue et la confirmation ; une confirmation anticipée compte 0. */
    static Long medianConfirmationDelay(List<DoseDto> doses) {
        List<Long> delays = doses.stream()
                .filter(d -> d.statut() == DoseStatus.CONFIRME && d.horodatageAction() != null)
                .map(d -> Math.max(0, Duration.between(d.datePrevue(), d.horodatageAction()).toMinutes()))
                .sorted()
                .toList();
        if (delays.isEmpty()) {
            return null;
        }
        int middle = delays.size() / 2;
        return delays.size() % 2 == 1 ? delays.get(middle)
                : Math.round((delays.get(middle - 1) + delays.get(middle)) / 2.0);
    }

    /** Moyenne brute des taux de réussite des exercices non interrompus. */
    static BigDecimal meanRate(List<SessionDto> sessions) {
        List<BigDecimal> rates = sessions.stream()
                .filter(s -> !s.interrompu() && s.tauxReussite() != null)
                .map(SessionDto::tauxReussite)
                .toList();
        if (rates.isEmpty()) {
            return null;
        }
        return rates.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(rates.size()), 1, RoundingMode.HALF_UP);
    }

    private static DoseLine doseLine(DoseDto d, ZoneId zone) {
        LocalDateTime prevue = LocalDateTime.ofInstant(d.datePrevue(), zone);
        LocalTime confirmed = d.statut() == DoseStatus.CONFIRME && d.horodatageAction() != null
                ? LocalTime.ofInstant(d.horodatageAction(), zone) : null;
        return new DoseLine(prevue.toLocalDate(), prevue.toLocalTime(), d.nomMedicament(), d.statut(), confirmed);
    }

    private static ExerciseLine exerciseLine(SessionDto s, ZoneId zone) {
        String type = switch (s.typeExercice()) {
            case RAPPEL_MOTS -> "Rappel de mots";
            case ASSOCIATION_VISUELLE -> "Association image–mot";
        };
        return new ExerciseLine(LocalDateTime.ofInstant(s.dateExercice(), zone), type, s.corrects(), s.motsPresentes(),
                s.dureeSec(), s.interrompu());
    }

    private static int count(List<DoseDto> doses, DoseStatus status) {
        return (int) doses.stream().filter(d -> d.statut() == status).count();
    }

    private static java.time.Instant startOf(LocalDate day, ZoneId zone) {
        return day.atStartOfDay(zone).toInstant();
    }
}
