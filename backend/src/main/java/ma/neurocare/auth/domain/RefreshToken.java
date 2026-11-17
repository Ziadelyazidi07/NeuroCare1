package ma.neurocare.auth.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Refresh token stocké haché en SHA-256 (table {@code refresh_tokens}, cahier §8.1).
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expire_le", nullable = false)
    private Instant expireLe;

    @Column(name = "revoque", nullable = false)
    private boolean revoque;

    public RefreshToken(UUID userId, String tokenHash, Instant expireLe) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expireLe = expireLe;
    }
}
