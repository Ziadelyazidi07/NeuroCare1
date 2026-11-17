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
import ma.neurocare.common.domain.Language;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Fichier audio généré et mis en cache (table {@code audio_assets}).
 * Réutilisé tant que le texte et la voix sont inchangés.
 */
@Entity
@Table(name = "audio_assets")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AudioAsset extends BaseEntity {

    @Column(name = "medication_id")
    private UUID medicationId;

    @Column(name = "voice_profile_id")
    private UUID voiceProfileId;

    @Enumerated(EnumType.STRING)
    @Column(name = "langue", nullable = false, length = 10)
    private Language langue;

    @Column(name = "texte", nullable = false, length = 300)
    private String texte;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "source", nullable = false, columnDefinition = "audio_source")
    private AudioSource source;

    @Column(name = "storage_key", nullable = false, length = 255)
    private String storageKey;

    @Column(name = "duree_ms")
    private Integer dureeMs;

    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation = Instant.now();

    public AudioAsset(UUID medicationId, UUID voiceProfileId, Language langue, String texte,
                      AudioSource source, String storageKey) {
        this.medicationId = medicationId;
        this.voiceProfileId = voiceProfileId;
        this.langue = langue;
        this.texte = texte;
        this.source = source;
        this.storageKey = storageKey;
    }
}
