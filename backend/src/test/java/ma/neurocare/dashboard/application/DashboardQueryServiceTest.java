package ma.neurocare.dashboard.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.cognitive.api.dto.CognitiveDtos;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionHistoryDto;
import ma.neurocare.cognitive.application.CognitiveService;
import ma.neurocare.dashboard.api.dto.DashboardDtos.HistoryDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.JourDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.TodayDto;
import ma.neurocare.reminder.api.dto.DoseDtos.DoseDto;
import ma.neurocare.reminder.application.DoseService;
import ma.neurocare.reminder.domain.DoseStatus;
import org.junit.jupiter.api.Test;

/** EF-DA-01 (pastilles) et EF-DA-03 (taux de confirmation par jour). */
class DashboardQueryServiceTest {

    private static final ZoneId CASABLANCA = ZoneId.of("Africa/Casablanca");
    private static final Instant NOW = Instant.parse("2026-11-17T15:00:00Z"); // 16:00 à Casablanca
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 17);

    private final DoseService doses = mock(DoseService.class);
    private final CognitiveService cognitive = mock(CognitiveService.class);
    private final DashboardQueryService service =
            new DashboardQueryService(doses, cognitive, Clock.fixed(NOW, CASABLANCA));
    private final UUID seniorId = UUID.randomUUID();

    @Test
    void todayShowsOnePillPerDoseWithItsColour() {
        when(doses.zoneOf(seniorId)).thenReturn(CASABLANCA);
        when(doses.dosesOfDay(seniorId, TODAY)).thenReturn(List.of(
                dose("2026-11-17T07:00:00Z", DoseStatus.CONFIRME),
                dose("2026-11-17T11:00:00Z", DoseStatus.SANS_REPONSE),
                dose("2026-11-17T19:00:00Z", DoseStatus.EN_ATTENTE),
                dose("2026-11-17T20:00:00Z", DoseStatus.DESACTIVE)));
        when(cognitive.latest(seniorId)).thenReturn(Optional.empty());

        TodayDto today = service.today(seniorId);

        assertThat(today.date()).isEqualTo(TODAY);
        assertThat(today.prises()).extracting(p -> p.couleur()).containsExactly("VERT", "ORANGE", "GRIS", "GRIS");
        assertThat(today.resume().total()).isEqualTo(4);
        assertThat(today.resume().confirmees()).isEqualTo(1);
        assertThat(today.resume().sansReponse()).isEqualTo(1);
        assertThat(today.dernierExercice()).isNull();
        assertThat(today.avertissement()).contains("aucun diagnostic");
    }

    @Test
    void historyCountsOnlyClosedDosesInTheRate() {
        when(doses.zoneOf(seniorId)).thenReturn(CASABLANCA);
        when(doses.dosesBetween(seniorId, TODAY.minusDays(6), TODAY)).thenReturn(List.of(
                // J-1 : 3 confirmées, 1 sans réponse → 75 %
                dose("2026-11-16T07:00:00Z", DoseStatus.CONFIRME),
                dose("2026-11-16T11:00:00Z", DoseStatus.CONFIRME),
                dose("2026-11-16T15:00:00Z", DoseStatus.CONFIRME),
                dose("2026-11-16T19:00:00Z", DoseStatus.SANS_REPONSE),
                // J : 1 confirmée, 1 en attente, 1 désactivée → 100 % (les non clôturées ne comptent pas)
                dose("2026-11-17T07:00:00Z", DoseStatus.CONFIRME),
                dose("2026-11-17T19:00:00Z", DoseStatus.EN_ATTENTE),
                dose("2026-11-17T20:00:00Z", DoseStatus.DESACTIVE),
                // 23:30 UTC le 16 = 00:30 le 17 à Casablanca : compté le 17.
                dose("2026-11-16T23:30:00Z", DoseStatus.SANS_REPONSE)));
        when(cognitive.history(eq(seniorId), any(), any()))
                .thenReturn(new SessionHistoryDto(CognitiveDtos.AVERTISSEMENT, List.of()));

        HistoryDto history = service.history(seniorId, 7);

        assertThat(history.jours()).hasSize(7);
        assertThat(history.du()).isEqualTo(TODAY.minusDays(6));
        assertThat(history.au()).isEqualTo(TODAY);
        JourDto yesterday = history.jours().get(5);
        JourDto today = history.jours().get(6);
        assertThat(yesterday.tauxConfirmation()).isEqualByComparingTo(new BigDecimal("75.00"));
        assertThat(today.confirmees()).isEqualTo(1);
        assertThat(today.sansReponse()).isEqualTo(1);
        assertThat(today.enAttente()).isEqualTo(1);
        assertThat(today.desactivees()).isEqualTo(1);
        assertThat(today.tauxConfirmation()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(history.jours().get(0).tauxConfirmation()).isNull(); // aucun rappel ce jour-là
        assertThat(history.tauxConfirmationPeriode()).isEqualByComparingTo(new BigDecimal("66.67"));
    }

    @Test
    void rateIsNullWithoutClosedDoses() {
        assertThat(DashboardQueryService.rate(0, 0)).isNull();
        assertThat(DashboardQueryService.rate(0, 2)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    private static DoseDto dose(String at, DoseStatus status) {
        return new DoseDto(UUID.randomUUID(), UUID.randomUUID(), "Metformine 500", null, Instant.parse(at), status,
                status == DoseStatus.CONFIRME ? Instant.parse(at).plusSeconds(120) : null);
    }
}
