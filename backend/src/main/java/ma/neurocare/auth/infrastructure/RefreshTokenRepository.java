package ma.neurocare.auth.infrastructure;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import ma.neurocare.auth.domain.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    /** Verrou pessimiste : deux rafraîchissements simultanés du même token ne peuvent pas tous deux réussir. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken t set t.revoque = true where t.familyId = :familyId and t.revoque = false")
    int revokeFamily(@Param("familyId") UUID familyId);
}
