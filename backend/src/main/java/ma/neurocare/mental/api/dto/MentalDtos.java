package ma.neurocare.mental.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.neurocare.mental.domain.GdsLevel;

/** DTO du module Santé mentale (Mini-GDS / GDS-15), toujours avec la mention de non-diagnostic. */
public final class MentalDtos {

    public static final String AVERTISSEMENT = "Questionnaire de pré-dépistage (Mini-GDS / GDS-15) : il ne constitue "
            + "pas un diagnostic médical officiel et ne remplace pas un médecin.";

    private MentalDtos() {
    }

    /** Réponses par code de question (ex. {@code MINI_DECOURAGE}, {@code GDS_01}) : true = Oui, false = Non. */
    public record AssessmentRequest(
            @NotEmpty @Size(max = 16) Map<@NotNull String, @NotNull Boolean> reponses,
            Instant datePassation) {
    }

    public record AssessmentDto(
            UUID id,
            Instant datePassation,
            Map<String, Boolean> reponses,
            int scoreMiniGds,
            Integer scoreGds15,
            GdsLevel niveau,
            String avertissement) {
    }

    public record HistoryDto(String avertissement, List<AssessmentDto> passations) {
    }
}
