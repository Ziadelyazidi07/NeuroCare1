package ma.neurocare.notification.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Appareil enregistré : token FCM et, pour un senior, token d'appareil haché (table {@code devices}).
 */
@Entity
@Table(name = "devices")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Device extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "plateforme", nullable = false, length = 10)
    private Platform plateforme;

    @Column(name = "fcm_token", length = 255)
    private String fcmToken;

    /** SHA-256 du token d'appareil senior. */
    @Column(name = "device_token_hash", length = 64)
    private String deviceTokenHash;

    @Column(name = "revoque", nullable = false)
    private boolean revoque;

    @Column(name = "derniere_activite")
    private Instant derniereActivite;

    public Device(UUID userId, Platform plateforme) {
        this.userId = userId;
        this.plateforme = plateforme;
    }
}
