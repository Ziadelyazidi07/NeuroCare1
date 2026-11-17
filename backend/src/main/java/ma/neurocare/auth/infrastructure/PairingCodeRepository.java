package ma.neurocare.auth.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import ma.neurocare.auth.domain.PairingCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PairingCodeRepository extends JpaRepository<PairingCode, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PairingCode> findFirstByCodeHashAndUtiliseFalseAndExpireLeAfter(String codeHash, Instant now);

    boolean existsByCodeHashAndUtiliseFalseAndExpireLeAfter(String codeHash, Instant now);

    /** Un seul code actif par senior : générer un nouveau code invalide les précédents. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PairingCode p set p.utilise = true where p.seniorId = :seniorId and p.utilise = false")
    int invalidateActive(@Param("seniorId") UUID seniorId);
}
