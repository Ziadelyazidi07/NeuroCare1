package ma.neurocare.notification.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.neurocare.notification.domain.Platform;

public record RegisterDeviceRequest(@NotNull Platform plateforme, @NotBlank @Size(max = 255) String fcmToken) {
}
