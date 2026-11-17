package ma.neurocare.auth.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Refresh token stocké haché en SHA-256 (table {@code refresh_tokens}, cahier §8.1).
 * Tous les tokens issus d'une même connexion partagent un {@code familyId} :
 * la réutilisation d'un token déjà consommé révoque toute la famille.
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "family_id", nullable = false, updatable = false)
    private UUID familyId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64, updatable = false)
    private String tokenHash;

    @Column(name = "expire_le", nullable = false, updatable = false)
    private Instant expireLe;

    @Column(name = "revoque", nullable = false)
    private boolean revoque;

    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation;

    public RefreshToken(UUID userId, UUID familyId, String tokenHash, Instant createdAt, Instant expireLe) {
        this.userId = userId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.dateCreation = createdAt;
        this.expireLe = expireLe;
    }

    public boolean isExpired(Instant now) {
        return !expireLe.isAfter(now);
    }

    public void revoke() {
        this.revoque = true;
    }
}
