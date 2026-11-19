package ma.neurocare.saturation.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ma.neurocare.saturation.domain.Spo2Level;

/** DTO du module SpO2 : mesures au repos et niveau d'alerte, toujours avec la mention de non-diagnostic. */
public final class SaturationDtos {

    public static final String AVERTISSEMENT = "Outil de pré-dépistage et de suivi : ces mesures ne constituent pas "
            + "un diagnostic médical officiel et ne remplacent pas un médecin.";

    private SaturationDtos() {
    }

    /** {@code maladieRespiratoireChronique} vaut {@code null} tant que la question n'a pas été posée. */
    public record ProfileDto(Boolean maladieRespiratoireChronique, Instant misAJourLe) {
    }

    public record ProfileRequest(@NotNull Boolean maladieRespiratoireChronique) {
    }

    public record MeasurementRequest(
            @NotNull @Min(Spo2Level.MIN_SPO2) @Max(Spo2Level.MAX_SPO2) Integer spo2,
            @NotNull @Min(30) @Max(220) Integer pouls,
            Instant dateMesure) {
    }

    public record MeasurementDto(
            UUID id,
            Instant dateMesure,
            int spo2,
            int pouls,
            boolean maladieRespiratoireChronique,
            Spo2Level niveau) {
    }

    public record HistoryDto(String avertissement, List<MeasurementDto> mesures) {
    }
}
