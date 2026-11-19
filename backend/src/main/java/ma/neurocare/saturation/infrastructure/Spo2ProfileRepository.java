package ma.neurocare.saturation.infrastructure;

import java.util.UUID;

import ma.neurocare.saturation.domain.Spo2Profile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface Spo2ProfileRepository extends JpaRepository<Spo2Profile, UUID> {
}
