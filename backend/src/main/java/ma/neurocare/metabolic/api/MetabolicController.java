package ma.neurocare.metabolic.api;

import java.net.URI;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.metabolic.api.dto.MetabolicDtos.AssessmentDto;
import ma.neurocare.metabolic.api.dto.MetabolicDtos.AssessmentRequest;
import ma.neurocare.metabolic.api.dto.MetabolicDtos.HistoryDto;
import ma.neurocare.metabolic.application.MetabolicService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Métabolique (FINDRISC)", description = "Pré-dépistage du diabète de type 2, sans diagnostic")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/findrisc/assessments")
@RequiredArgsConstructor
public class MetabolicController {

    private final MetabolicService metabolicService;

    @Operation(summary = "Enregistre un questionnaire FINDRISC ; IMC et score sont recalculés par le serveur")
    @PostMapping
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    public ResponseEntity<AssessmentDto> record(@PathVariable UUID seniorId, @Valid @RequestBody AssessmentRequest request) {
        AssessmentDto saved = metabolicService.record(seniorId, CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/v1/seniors/" + seniorId + "/findrisc/assessments/" + saved.id()))
                .body(saved);
    }

    @Operation(summary = "Historique des questionnaires, le plus récent en premier")
    @GetMapping
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    @AuditHealthRead("READ_FINDRISC_ASSESSMENTS")
    public HistoryDto history(@PathVariable UUID seniorId) {
        return metabolicService.history(seniorId);
    }
}
