package ma.neurocare.medication.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.medication.api.dto.MedicationDtos.MedicationDto;
import ma.neurocare.medication.api.dto.MedicationDtos.MedicationRequest;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Traitements", description = "Traitements saisis à partir d'une prescription existante — aucune posologie calculée")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class MedicationController {

    private final MedicationService medicationService;

    @Operation(summary = "Crée un traitement et ses horaires (AIDANT lié + RAPPELS)")
    @PostMapping("/seniors/{seniorId}/medications")
    @PreAuthorize("@accessPolicy.canManageMedications(#seniorId, authentication)")
    public ResponseEntity<MedicationDto> create(@PathVariable UUID seniorId,
                                                @Valid @RequestBody MedicationRequest request) {
        MedicationDto created = medicationService.create(seniorId, request, CurrentUser.get().userId());
        return ResponseEntity.created(URI.create("/api/v1/medications/" + created.id())).body(created);
    }

    @Operation(summary = "Liste des traitements actifs (AIDANT lié + RAPPELS, ou SENIOR)")
    @GetMapping("/seniors/{seniorId}/medications")
    @PreAuthorize("@accessPolicy.canViewMedications(#seniorId, authentication)")
    public List<MedicationDto> list(@PathVariable UUID seniorId) {
        return medicationService.listActive(seniorId);
    }

    @Operation(summary = "Modifie nom, consigne, dates et horaires")
    @PutMapping("/medications/{id}")
    @PreAuthorize("@accessPolicy.canManageMedications(@medicationService.seniorIdOf(#id), authentication)")
    public MedicationDto update(@PathVariable UUID id, @Valid @RequestBody MedicationRequest request) {
        return medicationService.update(id, request);
    }

    @Operation(summary = "Désactive le traitement (prises en attente → DESACTIVE)")
    @PatchMapping("/medications/{id}/deactivate")
    @PreAuthorize("@accessPolicy.canManageMedications(@medicationService.seniorIdOf(#id), authentication)")
    public MedicationDto deactivate(@PathVariable UUID id) {
        return medicationService.deactivate(id);
    }
}
