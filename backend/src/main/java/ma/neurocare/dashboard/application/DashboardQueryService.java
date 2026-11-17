package ma.neurocare.dashboard.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import ma.neurocare.cognitive.application.CognitiveService;
import ma.neurocare.dashboard.api.dto.DashboardDtos;
import ma.neurocare.dashboard.api.dto.DashboardDtos.DernierExerciceDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.HistoryDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.JourDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.PointExerciceDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.PriseDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.ResumeDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.TodayDto;
import ma.neurocare.reminder.api.dto.DoseDtos.DoseDto;
import ma.neurocare.reminder.application.DoseService;
import ma.neurocare.reminder.domain.DoseStatus;
import org.springframework.stereotype.Service;

/**
 * Lectures du tableau de bord (EF-DA-01, EF-DA-03, EF-CG-04). Les jours sont ceux du fuseau du senior.
 * L'autorisation (lien validé + PARTAGE_FAMILIAL) et l'audit sont appliqués par le contrôleur.
 */
@Service
@RequiredArgsConstructor
public class DashboardQueryService {

    private final DoseService doseService;
    private final CognitiveService cognitiveService;
    private final Clock clock;

    public TodayDto today(UUID seniorId) {
        ZoneId zone = doseService.zoneOf(seniorId);
        LocalDate day = LocalDate.now(clock.withZone(zone));
        List<PriseDto> prises = doseService.dosesOfDay(seniorId, day).stream()
                .map(DashboardQueryService::toPrise)
                .toList();
        DernierExerciceDto dernier = cognitiveService.latest(seniorId)
                .map(s -> new DernierExerciceDto(s.id(), s.dateExercice(), s.typeExercice(), s.motsPresentes(),
                        s.corrects(), s.interrompu()))
                .orElse(null);
        return new TodayDto(seniorId, day, prises, summarize(prises), dernier, DashboardDtos.AVERTISSEMENT);
    }

    /** Historique des {@code days} derniers jours, jour courant inclus. */
    public HistoryDto history(UUID seniorId, int days) {
        ZoneId zone = doseService.zoneOf(seniorId);
        LocalDate last = LocalDate.now(clock.withZone(zone));
        LocalDate first = last.minusDays(days - 1L);

        Map<LocalDate, List<DoseDto>> byDay = doseService.dosesBetween(seniorId, first, last).stream()
                .collect(Collectors.groupingBy(d -> LocalDate.ofInstant(d.datePrevue(), zone)));
        List<JourDto> jours = new ArrayList<>();
        int totalConfirmees = 0;
        int totalSansReponse = 0;
        for (LocalDate day = first; !day.isAfter(last); day = day.plusDays(1)) {
            List<DoseDto> list = byDay.getOrDefault(day, List.of());
            int confirmees = count(list, DoseStatus.CONFIRME);
            int sansReponse = count(list, DoseStatus.SANS_REPONSE);
            totalConfirmees += confirmees;
            totalSansReponse += sansReponse;
            jours.add(new JourDto(day, confirmees, sansReponse, count(list, DoseStatus.EN_ATTENTE),
                    count(list, DoseStatus.DESACTIVE), rate(confirmees, sansReponse)));
        }

        List<PointExerciceDto> exercices = cognitiveService
                .history(seniorId, first.atStartOfDay(zone).toInstant(), last.plusDays(1).atStartOfDay(zone).toInstant())
                .sessions().stream()
                .map(s -> new PointExerciceDto(s.dateExercice(), s.motsPresentes(), s.corrects(), s.tauxReussite(),
                        s.interrompu()))
                .toList();
        return new HistoryDto(seniorId, first, last, jours, rate(totalConfirmees, totalSansReponse), exercices,
                DashboardDtos.AVERTISSEMENT);
    }

    static PriseDto toPrise(DoseDto d) {
        return new PriseDto(d.id(), d.medicationId(), d.nomMedicament(), d.consigne(), d.datePrevue(), d.statut(),
                d.statut().couleur(), d.horodatageAction());
    }

    static ResumeDto summarize(List<PriseDto> prises) {
        return new ResumeDto(prises.size(),
                (int) prises.stream().filter(p -> p.statut() == DoseStatus.CONFIRME).count(),
                (int) prises.stream().filter(p -> p.statut() == DoseStatus.SANS_REPONSE).count(),
                (int) prises.stream().filter(p -> p.statut() == DoseStatus.EN_ATTENTE).count(),
                (int) prises.stream().filter(p -> p.statut() == DoseStatus.DESACTIVE).count());
    }

    /** Confirmées / (confirmées + sans réponse), en %. Les prises en attente ou désactivées ne comptent pas. */
    static BigDecimal rate(int confirmees, int sansReponse) {
        int closed = confirmees + sansReponse;
        if (closed == 0) {
            return null;
        }
        return BigDecimal.valueOf(confirmees * 100L).divide(BigDecimal.valueOf(closed), 2, RoundingMode.HALF_UP);
    }

    private static int count(List<DoseDto> list, DoseStatus status) {
        return (int) list.stream().filter(d -> d.statut() == status).count();
    }
}
