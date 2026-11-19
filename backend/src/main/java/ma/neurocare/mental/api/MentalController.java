package ma.neurocare.mental.api;

import java.net.URI;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.mental.api.dto.MentalDtos.AssessmentDto;
import ma.neurocare.mental.api.dto.MentalDtos.AssessmentRequest;
import ma.neurocare.mental.api.dto.MentalDtos.HistoryDto;
import ma.neurocare.mental.application.MentalService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Santé mentale", description = "Pré-dépistage Mini-GDS / GDS-15, sans diagnostic")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/gds/assessments")
@RequiredArgsConstructor
public class MentalController {

    private final MentalService mentalService;

    @Operation(summary = "Enregistre une passation ; le score est recalculé par le serveur")
    @PostMapping
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    public ResponseEntity<AssessmentDto> record(@PathVariable UUID seniorId, @Valid @RequestBody AssessmentRequest request) {
        AssessmentDto saved = mentalService.record(seniorId, CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/v1/seniors/" + seniorId + "/gds/assessments/" + saved.id()))
                .body(saved);
    }

    @Operation(summary = "Historique des passations, la plus récente en premier")
    @GetMapping
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    @AuditHealthRead("READ_GDS_ASSESSMENTS")
    public HistoryDto history(@PathVariable UUID seniorId) {
        return mentalService.history(seniorId);
    }
}
