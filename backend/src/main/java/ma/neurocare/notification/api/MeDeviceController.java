package ma.neurocare.notification.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.notification.api.dto.RegisterDeviceRequest;
import ma.neurocare.notification.application.DeviceService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Appareils")
@RestController
@RequiredArgsConstructor
public class MeDeviceController {

    private final DeviceService deviceService;

    @Operation(summary = "Enregistre / met à jour le token FCM (SENIOR, AIDANT)")
    @PostMapping("/api/v1/me/devices")
    public ResponseEntity<Void> register(@Valid @RequestBody RegisterDeviceRequest request) {
        deviceService.registerFcmToken(CurrentUser.get(), request.plateforme(), request.fcmToken());
        return ResponseEntity.noContent().build();
    }
}
