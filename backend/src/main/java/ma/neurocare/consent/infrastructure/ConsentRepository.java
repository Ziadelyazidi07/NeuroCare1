package ma.neurocare.consent.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import ma.neurocare.consent.domain.Consent;
import ma.neurocare.consent.domain.ConsentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsentRepository extends JpaRepository<Consent, UUID> {

    Optional<Consent> findBySeniorIdAndType(UUID seniorId, ConsentType type);

    List<Consent> findBySeniorId(UUID seniorId);

    boolean existsBySeniorIdAndTypeAndAccordeTrue(UUID seniorId, ConsentType type);

    @Query("select c.seniorId from Consent c where c.type = :type and c.accorde = true and c.seniorId in :ids")
    Set<UUID> findGrantedSeniorIds(@Param("type") ConsentType type, @Param("ids") Collection<UUID> seniorIds);
}
