package ma.neurocare.consent.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.consent.domain.Consent;
import ma.neurocare.consent.domain.ConsentType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsentRepository extends JpaRepository<Consent, UUID> {

    Optional<Consent> findBySeniorIdAndType(UUID seniorId, ConsentType type);

    List<Consent> findBySeniorId(UUID seniorId);

    boolean existsBySeniorIdAndTypeAndAccordeTrue(UUID seniorId, ConsentType type);
}
