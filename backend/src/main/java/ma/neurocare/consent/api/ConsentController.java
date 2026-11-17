package ma.neurocare.consent.api;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.consent.api.dto.ConsentDto;
import ma.neurocare.consent.api.dto.ConsentHistoryDto;
import ma.neurocare.consent.api.dto.ConsentUpdateRequest;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.ConsentService;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Consentements", description = "Accords séparés, traçables et révocables")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}")
@RequiredArgsConstructor
public class ConsentController {

    private final ConsentService consentService;
    private final CaregiverLinkService linkService;

    @Operation(summary = "État des 4 consentements")
    @GetMapping("/consents")
    @PreAuthorize("@accessPolicy.isSelfOrLinkedCaregiver(#seniorId, authentication)")
    public List<ConsentDto> list(@PathVariable UUID seniorId) {
        return consentService.list(seniorId);
    }

    @Operation(summary = "Accorde ou révoque un consentement",
            description = "Le senior lui-même, ou un aidant lié en présence du senior (tracé).")
    @PutMapping("/consents/{type}")
    @PreAuthorize("@accessPolicy.isSelfOrLinkedCaregiver(#seniorId, authentication)")
    public ConsentDto update(@PathVariable UUID seniorId, @PathVariable ConsentType type,
                             @Valid @RequestBody ConsentUpdateRequest request) {
        return consentService.update(seniorId, type, request, CurrentUser.get());
    }

    @Operation(summary = "Journal des consentements")
    @GetMapping("/consents/history")
    @PreAuthorize("@accessPolicy.isSelfOrLinkedCaregiver(#seniorId, authentication)")
    public List<ConsentHistoryDto> history(@PathVariable UUID seniorId) {
        return consentService.history(seniorId);
    }

    @Operation(summary = "Rompt le lien senior–aidant")
    @DeleteMapping("/caregivers/{aidantId}")
    @PreAuthorize("@accessPolicy.canBreakLink(#seniorId, #aidantId, authentication)")
    public ResponseEntity<Void> breakLink(@PathVariable UUID seniorId, @PathVariable UUID aidantId) {
        linkService.deleteLink(seniorId, aidantId);
        return ResponseEntity.noContent().build();
    }
}
