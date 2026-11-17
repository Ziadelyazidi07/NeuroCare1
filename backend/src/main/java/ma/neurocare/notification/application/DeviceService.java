package ma.neurocare.notification.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.notification.api.dto.DeviceDto;
import ma.neurocare.notification.domain.Device;
import ma.neurocare.notification.domain.Platform;
import ma.neurocare.notification.infrastructure.DeviceRepository;
import ma.neurocare.security.AuthenticatedUser;
import ma.neurocare.security.DeviceTokenAuthenticator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Appareils enregistrés. Pour un senior, le token d'appareil (haché) remplace le mot de passe ;
 * il est révocable par l'aidant en cas de perte du téléphone (EF-AU-05).
 */
@Service
@RequiredArgsConstructor
public class DeviceService implements DeviceTokenAuthenticator {

    /** Évite une écriture en base à chaque requête. */
    private static final Duration ACTIVITY_GRANULARITY = Duration.ofMinutes(5);

    private final DeviceRepository devices;
    private final Clock clock;

    @Transactional
    public UUID registerSeniorDevice(UUID seniorId, Platform plateforme, String deviceTokenHash) {
        Device device = new Device(seniorId, plateforme);
        device.setDeviceTokenHash(deviceTokenHash);
        device.setDerniereActivite(clock.instant());
        return devices.save(device).getId();
    }

    @Override
    @Transactional
    public Optional<AuthenticatedUser> authenticate(String deviceTokenHash) {
        return devices.findByDeviceTokenHashAndRevoqueFalse(deviceTokenHash).map(device -> {
            Instant now = clock.instant();
            if (device.getDerniereActivite() == null
                    || device.getDerniereActivite().plus(ACTIVITY_GRANULARITY).isBefore(now)) {
                device.setDerniereActivite(now);
            }
            return AuthenticatedUser.ofDevice(device.getUserId(), device.getId());
        });
    }

    @Transactional(readOnly = true)
    public List<DeviceDto> listForSenior(UUID seniorId) {
        return devices.findByUserIdOrderByDerniereActiviteDesc(seniorId).stream()
                .map(d -> new DeviceDto(d.getId(), d.getPlateforme(), d.isRevoque(), d.getDerniereActivite()))
                .toList();
    }

    @Transactional
    public void revoke(UUID seniorId, UUID deviceId) {
        Device device = devices.findByIdAndUserId(deviceId, seniorId)
                .orElseThrow(() -> BusinessException.notFound("Appareil introuvable."));
        device.setRevoque(true);
        device.setFcmToken(null);
    }
}
