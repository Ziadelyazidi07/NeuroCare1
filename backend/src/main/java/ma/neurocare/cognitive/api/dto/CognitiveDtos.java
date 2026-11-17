package ma.neurocare.cognitive.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.neurocare.cognitive.domain.ExerciseType;
import ma.neurocare.common.domain.Language;

/**
 * DTO du module COGNI (cahier §7.6). Données brutes et descriptives uniquement : aucun champ de type
 * score clinique, risque, probabilité ou diagnostic (§13.3).
 */
public final class CognitiveDtos {

    /** Mention affichée partout où des résultats d'exercice sont présentés (risque §17.1). */
    public static final String AVERTISSEMENT = "Exercice de stimulation facultatif. Les résultats sont des données "
            + "brutes, sans valeur de diagnostic : NeuroCare ne détecte pas Alzheimer.";

    private CognitiveDtos() {
    }

    public record WordDto(String mot, String ecritureArabe) {
    }

    /** Exercice tiré pour le senior : mots à mémoriser, pause, puis choix parmi 9 propositions. */
    public record ExerciseDto(
            ExerciseType type,
            Language langue,
            List<WordDto> motsPresentes,
            List<WordDto> propositions,
            int delaiRappelSec,
            boolean facultatif) {
    }

    /** Résultat envoyé par l'application (le senior peut interrompre à tout moment, sans pénalité). */
    public record SessionRequest(
            @NotNull ExerciseType type,
            @NotNull @Size(min = 3, max = 5) List<@NotNull String> motsPresentes,
            @NotNull @Size(min = 9, max = 9) List<@NotNull String> propositions,
            @NotNull @Size(max = 5) List<@NotNull String> motsChoisis,
            @Min(0) @Max(600) int delaiRappelSec,
            @Size(max = 9) List<@NotNull @Min(0) Integer> tempsReponseMs,
            @Min(0) @Max(3600) Integer dureeSec,
            boolean interrompu,
            Instant dateExercice) {
    }

    public record SessionDto(
            UUID id,
            Instant dateExercice,
            ExerciseType typeExercice,
            Language langue,
            int motsPresentes,
            int corrects,
            BigDecimal tauxReussite,
            Integer dureeSec,
            boolean interrompu,
            Map<String, Object> resultatBrut) {
    }

    public record SessionHistoryDto(String avertissement, List<SessionDto> sessions) {
    }
}
