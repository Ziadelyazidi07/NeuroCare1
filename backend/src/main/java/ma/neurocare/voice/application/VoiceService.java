package ma.neurocare.voice.application;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.consent.application.ConsentChangedEvent;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.security.AuthenticatedUser;
import ma.neurocare.user.application.SeniorService;
import ma.neurocare.voice.api.dto.VoiceDtos.VoiceProfileDto;
import ma.neurocare.voice.application.VoiceEvents.VoiceDataPurgeRequested;
import ma.neurocare.voice.application.VoiceEvents.VoiceProfileStatusChanged;
import ma.neurocare.voice.application.VoiceEvents.VoiceSampleUploaded;
import ma.neurocare.voice.domain.AudioAsset;
import ma.neurocare.voice.domain.AudioSampleInspector;
import ma.neurocare.voice.domain.AudioSampleInspector.InvalidSampleException;
import ma.neurocare.voice.domain.AudioSampleInspector.SampleInfo;
import ma.neurocare.voice.domain.VoiceProfile;
import ma.neurocare.voice.domain.VoiceProfileStatus;
import ma.neurocare.voice.infrastructure.AudioAssetRepository;
import ma.neurocare.voice.infrastructure.AudioServiceClient;
import ma.neurocare.voice.infrastructure.AudioServiceClient.Enrollment;
import ma.neurocare.voice.infrastructure.VoiceProfileRepository;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profil vocal d'un aidant pour un senior (EF-VO-01, EF-VO-02, EF-CO-05 ; cahier §10.3).
 * L'autorisation (lien + VOIX) est vérifiée en amont par {@code AccessPolicy}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoiceService {

    private final VoiceProfileRepository profiles;
    private final AudioAssetRepository assets;
    private final VoiceProfileFinder finder;
    private final ObjectStorage storage;
    private final AudioServiceClient audioService;
    private final AudioGenerationService audioGeneration;
    private final CaregiverLinkService linkService;
    private final SeniorService seniorService;
    private final MedicationService medicationService;
    private final ApplicationEventPublisher events;
    private final NeuroCareProperties properties;

    /**
     * Étapes 1-3 du pipeline (§10.3) : contrôle du fichier, stockage privé, profil EN_COURS. L'appel au
     * microservice part après commit ; un nouvel enregistrement remplace le précédent.
     */
    @Transactional
    public VoiceProfileDto upload(UUID seniorId, MultipartFile file, AuthenticatedUser caller) {
        byte[] content = read(file);
        SampleInfo sample;
        try {
            sample = AudioSampleInspector.check(content);
        } catch (InvalidSampleException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, e.getMessage());
        }
        CaregiverLinkView link = linkService.findLink(seniorId, caller.userId())
                .orElseThrow(() -> BusinessException.notFound("Senior introuvable."));

        purge(seniorId);

        String key = seniorId + "/" + UUID.randomUUID() + "." + sample.format().extension();
        storage.put(properties.storage().voiceSamplesBucket(), key, content, sample.format().mediaType());
        VoiceProfile profile = profiles.save(new VoiceProfile(link.id(), key));
        events.publishEvent(new VoiceSampleUploaded(profile.getId(), seniorId));
        return toDto(profile);
    }

    @Transactional(readOnly = true)
    public VoiceProfileDto current(UUID seniorId) {
        return finder.latest(seniorId).map(VoiceService::toDto)
                .orElseThrow(() -> BusinessException.notFound("Aucun profil vocal."));
    }

    /** Supprime la voix et les audios générés avec elle (DELETE /seniors/{id}/voice-profile). */
    @Transactional
    public void delete(UUID seniorId) {
        purge(seniorId);
    }

    /** EF-CO-05 : la révocation de VOIX supprime l'échantillon et les audios clonés. */
    @EventListener
    public void onConsentChanged(ConsentChangedEvent event) {
        if (event.type() == ConsentType.VOIX && !event.accorde()) {
            int purged = purge(event.seniorId());
            log.info("Consentement VOIX révoqué : {} profil(s) vocal(aux) supprimé(s)", purged);
        }
    }

    /**
     * Étape 3 (§10.3), après commit : enrôlement auprès du microservice → PRET ou ECHEC.
     * PRET déclenche la régénération des messages du senior avec sa voix.
     */
    public void enroll(UUID voiceProfileId, UUID seniorId) {
        VoiceProfile profile = profiles.findById(voiceProfileId).orElse(null);
        if (profile == null) {
            return; // supprimé entre-temps (révocation, nouvel enregistrement)
        }
        VoiceProfileStatus status = VoiceProfileStatus.ECHEC;
        try {
            byte[] sample = storage.get(properties.storage().voiceSamplesBucket(), profile.getEchantillonKey())
                    .orElseThrow(() -> new IllegalStateException("Échantillon introuvable"));
            Enrollment enrollment = audioService.enrollVoice(sample, profile.getEchantillonKey(),
                    seniorService.audioProfile(seniorId).langue());
            if (enrollment.ready()) {
                profile.setProviderVoiceId(enrollment.voiceId());
                status = VoiceProfileStatus.PRET;
            } else {
                log.info("Clonage indisponible ({}) : l'enregistrement sera joué tel quel", enrollment.reason());
            }
        } catch (RuntimeException e) {
            log.warn("Enrôlement vocal en échec : {}", e.getClass().getSimpleName());
        }
        profile.setStatut(status);
        profiles.save(profile);
        events.publishEvent(new VoiceProfileStatusChanged(profile.getId(), seniorId, status));

        if (status == VoiceProfileStatus.PRET) {
            medicationService.activeMedicationIds(seniorId).forEach(audioGeneration::audioForMedicationAsync);
        }
    }

    /** Efface en base les profils du senior et leurs audios ; fichiers et voix distantes après commit. */
    private int purge(UUID seniorId) {
        List<VoiceProfile> existing = finder.profilesOfSenior(seniorId);
        if (existing.isEmpty()) {
            return 0;
        }
        List<UUID> ids = existing.stream().map(VoiceProfile::getId).toList();
        List<AudioAsset> cloned = assets.findByVoiceProfileIdIn(ids);
        List<String> sampleKeys = existing.stream().map(VoiceProfile::getEchantillonKey).toList();
        List<String> assetKeys = cloned.stream().map(AudioAsset::getStorageKey).toList();
        List<String> providerIds = new ArrayList<>();
        existing.stream().map(VoiceProfile::getProviderVoiceId).filter(id -> id != null).forEach(providerIds::add);

        assets.deleteAll(cloned);
        profiles.deleteAll(existing);
        events.publishEvent(new VoiceDataPurgeRequested(sampleKeys, assetKeys, providerIds));
        return existing.size();
    }

    private static byte[] read(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Fichier audio manquant.");
        }
        if (file.getSize() > AudioSampleInspector.MAX_BYTES) {
            throw new BusinessException(ErrorCode.PAYLOAD_TOO_LARGE, "Le fichier dépasse 5 Mo.");
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Fichier illisible.");
        }
    }

    private static VoiceProfileDto toDto(VoiceProfile profile) {
        return new VoiceProfileDto(profile.getId(), profile.getStatut(), profile.getDateCreation());
    }
}
