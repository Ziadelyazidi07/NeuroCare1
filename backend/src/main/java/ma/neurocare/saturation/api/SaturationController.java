package ma.neurocare.saturation.api;

import java.net.URI;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.saturation.api.dto.SaturationDtos.HistoryDto;
import ma.neurocare.saturation.api.dto.SaturationDtos.MeasurementDto;
import ma.neurocare.saturation.api.dto.SaturationDtos.MeasurementRequest;
import ma.neurocare.saturation.api.dto.SaturationDtos.ProfileDto;
import ma.neurocare.saturation.api.dto.SaturationDtos.ProfileRequest;
import ma.neurocare.saturation.application.SaturationService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Saturation SpO2", description = "Pré-dépistage et suivi : mesures au repos, sans diagnostic")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/spo2")
@RequiredArgsConstructor
public class SaturationController {

    private final SaturationService saturationService;

    @Operation(summary = "Profil respiratoire (maladie respiratoire chronique connue ou non)")
    @GetMapping("/profile")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    @AuditHealthRead("READ_SPO2_PROFILE")
    public ProfileDto profile(@PathVariable UUID seniorId) {
        return saturationService.profile(seniorId);
    }

    @Operation(summary = "Modifie le profil respiratoire (s'applique aux mesures suivantes)")
    @PutMapping("/profile")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    public ProfileDto updateProfile(@PathVariable UUID seniorId, @Valid @RequestBody ProfileRequest request) {
        return saturationService.updateProfile(seniorId, request.maladieRespiratoireChronique());
    }

    @Operation(summary = "Enregistre une mesure au repos et renvoie son niveau d'alerte")
    @PostMapping("/measurements")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    public ResponseEntity<MeasurementDto> record(@PathVariable UUID seniorId, @Valid @RequestBody MeasurementRequest request) {
        MeasurementDto saved = saturationService.record(seniorId, CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/v1/seniors/" + seniorId + "/spo2/measurements/" + saved.id()))
                .body(saved);
    }

    @Operation(summary = "Historique des mesures des 90 derniers jours, la plus récente en premier")
    @GetMapping("/measurements")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    @AuditHealthRead("READ_SPO2_MEASUREMENTS")
    public HistoryDto history(@PathVariable UUID seniorId) {
        return saturationService.history(seniorId);
    }
}
