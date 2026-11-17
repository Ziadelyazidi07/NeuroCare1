package ma.neurocare.voice.domain;

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
 * Profil vocal cloné d'un aidant pour un senior (table {@code voice_profiles}).
 */
@Entity
@Table(name = "voice_profiles")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VoiceProfile extends BaseEntity {

    @Column(name = "caregiver_link_id", nullable = false, updatable = false)
    private UUID caregiverLinkId;

    /** Clé de l'objet dans le bucket privé {@code voice-samples}. */
    @Column(name = "echantillon_key", nullable = false, length = 255)
    private String echantillonKey;

    /** Identifiant renvoyé par le microservice audio. */
    @Column(name = "provider_voice_id", length = 120)
    private String providerVoiceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut", nullable = false, length = 20)
    private VoiceProfileStatus statut = VoiceProfileStatus.EN_COURS;

    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation = Instant.now();

    public VoiceProfile(UUID caregiverLinkId, String echantillonKey) {
        this.caregiverLinkId = caregiverLinkId;
        this.echantillonKey = echantillonKey;
    }
}
