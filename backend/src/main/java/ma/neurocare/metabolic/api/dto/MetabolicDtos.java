package ma.neurocare.metabolic.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ma.neurocare.metabolic.domain.FamilyHistory;
import ma.neurocare.metabolic.domain.FindriscLevel;
import ma.neurocare.metabolic.domain.Sex;

/** DTO du module Métabolique (FINDRISC), toujours avec la mention de non-diagnostic. */
public final class MetabolicDtos {

    public static final String AVERTISSEMENT = "Score FINDRISC de pré-dépistage : il estime un risque, ne constitue "
            + "pas un diagnostic médical officiel de diabète et ne remplace pas un médecin.";

    private MetabolicDtos() {
    }

    public record AssessmentRequest(
            @NotNull @Min(18) @Max(120) Integer age,
            @NotNull Sex sexe,
            @NotNull @DecimalMin("20") @DecimalMax("350") BigDecimal poidsKg,
            @NotNull @DecimalMin("100") @DecimalMax("250") BigDecimal tailleCm,
            @NotNull @Min(40) @Max(200) Integer tourTailleCm,
            @NotNull Boolean activitePhysique,
            @NotNull Boolean fruitsLegumesQuotidiens,
            @NotNull Boolean medicamentsHypertension,
            @NotNull Boolean glycemieEleveeAntecedent,
            @NotNull FamilyHistory antecedentsFamiliaux,
            Instant datePassation) {
    }

    public record AssessmentDto(
            UUID id,
            Instant datePassation,
            int age,
            Sex sexe,
            BigDecimal poidsKg,
            BigDecimal tailleCm,
            BigDecimal imc,
            int tourTailleCm,
            boolean activitePhysique,
            boolean fruitsLegumesQuotidiens,
            boolean medicamentsHypertension,
            boolean glycemieEleveeAntecedent,
            FamilyHistory antecedentsFamiliaux,
            Map<String, Integer> points,
            int scoreTotal,
            FindriscLevel niveau,
            int pourcentageA10Ans,
            String avertissement) {
    }

    public record HistoryDto(String avertissement, List<AssessmentDto> passations) {
    }
}
