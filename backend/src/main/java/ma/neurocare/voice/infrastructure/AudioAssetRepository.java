package ma.neurocare.voice.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.common.domain.Language;
import ma.neurocare.voice.domain.AudioAsset;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AudioAssetRepository extends JpaRepository<AudioAsset, UUID> {

    Optional<AudioAsset> findFirstByMedicationIdAndTexteAndLangueAndVoiceProfileIdIsNullOrderByDateCreationDesc(
            UUID medicationId, String texte, Language langue);

    Optional<AudioAsset> findFirstByMedicationIdAndTexteAndLangueAndVoiceProfileIdOrderByDateCreationDesc(
            UUID medicationId, String texte, Language langue, UUID voiceProfileId);

    /** Cache (EF-VO-03) : même traitement, même texte, même langue, même voix (nulle pour le TTS standard). */
    default Optional<AudioAsset> findCached(UUID medicationId, String texte, Language langue, UUID voiceProfileId) {
        return voiceProfileId == null
                ? findFirstByMedicationIdAndTexteAndLangueAndVoiceProfileIdIsNullOrderByDateCreationDesc(
                        medicationId, texte, langue)
                : findFirstByMedicationIdAndTexteAndLangueAndVoiceProfileIdOrderByDateCreationDesc(
                        medicationId, texte, langue, voiceProfileId);
    }

    List<AudioAsset> findByMedicationIdOrderByDateCreationDesc(UUID medicationId);

    List<AudioAsset> findByVoiceProfileIdIn(Collection<UUID> voiceProfileIds);
}
