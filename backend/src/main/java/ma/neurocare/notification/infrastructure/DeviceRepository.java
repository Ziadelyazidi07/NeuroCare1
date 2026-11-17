package ma.neurocare.notification.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.notification.domain.Device;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceRepository extends JpaRepository<Device, UUID> {

    Optional<Device> findByDeviceTokenHashAndRevoqueFalse(String deviceTokenHash);

    List<Device> findByUserIdOrderByDerniereActiviteDesc(UUID userId);

    Optional<Device> findByIdAndUserId(UUID id, UUID userId);

    List<Device> findByUserIdAndRevoqueFalseAndFcmTokenIsNotNull(UUID userId);

    List<Device> findByFcmToken(String fcmToken);
}
