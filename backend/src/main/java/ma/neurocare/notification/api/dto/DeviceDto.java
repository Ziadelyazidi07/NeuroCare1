package ma.neurocare.notification.api.dto;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.notification.domain.Platform;

public record DeviceDto(UUID id, Platform plateforme, boolean revoque, Instant derniereActivite) {
}
