package ma.neurocare.cognitive.api;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.ExerciseDto;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionDto;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionHistoryDto;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionRequest;
import ma.neurocare.cognitive.application.CognitiveService;
import ma.neurocare.cognitive.domain.ExerciseType;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.security.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Exercices cognitifs", description = "Stimulation facultative ; résultats bruts, sans diagnostic")
@Validated
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class CognitiveController {

    private static final Duration MAX_RANGE = Duration.ofDays(366);

    private final CognitiveService cognitiveService;

    @Operation(summary = "Tire une série de mots dans la langue du senior (SENIOR + EXERCICES)")
    @GetMapping("/me/cognitive/next")
    @PreAuthorize("@accessPolicy.canDoExercise(authentication)")
    public ExerciseDto next(@RequestParam(defaultValue = "RAPPEL_MOTS") ExerciseType type,
                            @RequestParam(defaultValue = "3") @Min(3) @Max(5) int nombre) {
        return cognitiveService.next(CurrentUser.get().userId(), type, nombre);
    }

    @Operation(summary = "Enregistre le résultat brut d'un exercice (interrompu ou non)")
    @PostMapping("/me/cognitive/sessions")
    @PreAuthorize("@accessPolicy.canDoExercise(authentication)")
    public ResponseEntity<SessionDto> record(@Valid @RequestBody SessionRequest request) {
        SessionDto saved = cognitiveService.record(CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/v1/me/cognitive/sessions/" + saved.id())).body(saved);
    }

    @Operation(summary = "Historique descriptif (AIDANT lié + PARTAGE_FAMILIAL)")
    @GetMapping("/seniors/{seniorId}/cognitive/sessions")
    @PreAuthorize("@accessPolicy.canReadHealthData(#seniorId, authentication)")
    @AuditHealthRead("READ_COGNITIVE_SESSIONS")
    public SessionHistoryDto history(@PathVariable UUID seniorId,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        Instant end = to != null ? to : Instant.now();
        Instant start = from != null ? from : end.minus(Duration.ofDays(30));
        if (!start.isBefore(end) || Duration.between(start, end).compareTo(MAX_RANGE) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Période invalide (366 jours au plus).");
        }
        return cognitiveService.history(seniorId, start, end);
    }
}
