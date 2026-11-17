package ma.neurocare.user.infrastructure;

import java.util.UUID;

import ma.neurocare.user.domain.SeniorProfile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeniorProfileRepository extends JpaRepository<SeniorProfile, UUID> {
}
