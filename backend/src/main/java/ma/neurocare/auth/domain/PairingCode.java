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
 * Code d'appairage à 6 chiffres du téléphone senior, haché, valable 10 min
 * (table {@code pairing_codes}, EF-AU-04).
 */
@Entity
@Table(name = "pairing_codes")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PairingCode extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "expire_le", nullable = false)
    private Instant expireLe;

    @Column(name = "utilise", nullable = false)
    private boolean utilise;

    public PairingCode(UUID seniorId, String codeHash, Instant expireLe) {
        this.seniorId = seniorId;
        this.codeHash = codeHash;
        this.expireLe = expireLe;
    }
}
