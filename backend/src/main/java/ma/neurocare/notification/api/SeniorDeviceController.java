package ma.neurocare.notification.api;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import ma.neurocare.notification.api.dto.DeviceDto;
import ma.neurocare.notification.application.DeviceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Appareils appairés d'un senior (EF-AU-05). Routes ajoutées au cahier : l'exigence existe
 * mais aucun endpoint n'y était associé.
 */
@Tag(name = "Appareils", description = "Téléphones appairés du senior")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/devices")
@RequiredArgsConstructor
public class SeniorDeviceController {

    private final DeviceService deviceService;

    @Operation(summary = "Liste des appareils appairés")
    @GetMapping
    @PreAuthorize("@accessPolicy.isLinkedCaregiver(#seniorId, authentication)")
    public List<DeviceDto> list(@PathVariable UUID seniorId) {
        return deviceService.listForSenior(seniorId);
    }

    @Operation(summary = "Révoque le token d'appareil (perte du téléphone)")
    @DeleteMapping("/{deviceId}")
    @PreAuthorize("@accessPolicy.isLinkedCaregiver(#seniorId, authentication)")
    public ResponseEntity<Void> revoke(@PathVariable UUID seniorId, @PathVariable UUID deviceId) {
        deviceService.revoke(seniorId, deviceId);
        return ResponseEntity.noContent().build();
    }
}
