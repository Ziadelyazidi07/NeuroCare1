package ma.neurocare.cardio.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ma.neurocare.cardio.domain.BpLevel;
import ma.neurocare.cardio.domain.MeasureMoment;

/** DTO du module Cardio-vasculaire (tension et automesure), toujours avec la mention de non-diagnostic. */
public final class CardioDtos {

    public static final String AVERTISSEMENT = "Automesure tensionnelle de pré-dépistage et de suivi : elle ne "
            + "constitue pas un diagnostic médical officiel d'hypertension et ne remplace pas un médecin.";

    private CardioDtos() {
    }

    /** Mesure ponctuelle, ou créneau du protocole si {@code serieId} est fourni (avec jour, moment et rang). */
    public record MeasurementRequest(
            @NotNull @Min(BpLevel.MIN_TAS) @Max(BpLevel.MAX_TAS) Integer tas,
            @NotNull @Min(BpLevel.MIN_TAD) @Max(BpLevel.MAX_TAD) Integer tad,
            @NotNull @Min(30) @Max(220) Integer pouls,
            Instant dateMesure,
            UUID serieId,
            @Min(1) @Max(3) Integer jour,
            MeasureMoment moment,
            @Min(1) @Max(3) Integer rang) {
    }

    public record MeasurementDto(
            UUID id,
            Instant dateMesure,
            int tas,
            int tad,
            int pouls,
            BpLevel niveau,
            UUID serieId,
            Integer jour,
            MeasureMoment moment,
            Integer rang) {
    }

    public record SeriesRequest(@NotNull LocalDate dateDebut) {
    }

    /** Protocole sur 3 jours : mesures saisies et moyenne (évaluée sur 18 mesures quand {@code complet}). */
    public record SeriesDto(
            UUID id,
            LocalDate dateDebut,
            Instant creeLe,
            List<MeasurementDto> mesures,
            int nombreMesures,
            boolean complet,
            BigDecimal moyenneTas,
            BigDecimal moyenneTad,
            BigDecimal moyennePouls,
            boolean moyenneAuDessusDuSeuil,
            String avertissement) {
    }

    public record SeriesListDto(String avertissement, List<SeriesDto> series) {
    }

    public record HistoryDto(String avertissement, List<MeasurementDto> mesures) {
    }
}
