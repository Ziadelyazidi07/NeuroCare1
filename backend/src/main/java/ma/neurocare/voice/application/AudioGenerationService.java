package ma.neurocare.voice.application;

import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.common.domain.Language;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.config.AsyncConfig;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.medication.application.MedicationAudioInfo;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.user.application.SeniorAudioProfile;
import ma.neurocare.user.application.SeniorService;
import ma.neurocare.voice.domain.AudioAsset;
import ma.neurocare.voice.domain.AudioSource;
import ma.neurocare.voice.domain.ReminderMessageTemplate;
import ma.neurocare.voice.domain.VoiceProfile;
import ma.neurocare.voice.infrastructure.AudioAssetRepository;
import ma.neurocare.voice.infrastructure.AudioServiceClient;
import ma.neurocare.voice.infrastructure.AudioServiceClient.Synthesized;
import ma.neurocare.voice.infrastructure.AudioServiceRejectedException;
import ma.neurocare.voice.infrastructure.AudioServiceUnavailableException;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage.SignedUrl;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Message vocal de rappel d'un traitement : uniquement la voix de l'aidant, jamais de voix de synthèse.
 * <ol>
 *   <li>CLONE — message cloné, si profil PRET, consentement VOIX accordé et service disponible ;</li>
 *   <li>enregistrement de l'aidant joué tel quel, si le consentement VOIX est accordé ;</li>
 *   <li>PREENREGISTRE — aucun fichier serveur : le téléphone joue sa tonalité embarquée.</li>
 * </ol>
 * Les messages clonés sont mis en cache (EF-VO-03) tant que le texte et la voix sont inchangés.
 * Aucune transaction n'est tenue pendant les appels réseau.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AudioGenerationService {

    private final AudioServiceClient audioService;
    private final ObjectStorage storage;
    private final AudioAssetRepository assets;
    private final VoiceProfileFinder voices;
    private final MedicationService medicationService;
    private final SeniorService seniorService;
    private final CaregiverLinkService linkService;
    private final NeuroCareProperties properties;

    /** Résultat : la source retenue et le fichier (absent au niveau 3, joué depuis l'application). */
    public record AudioResult(AudioSource source, AudioAsset asset, String texte) {

        public Optional<AudioAsset> file() {
            return Optional.ofNullable(asset);
        }
    }

    /** Audio prêt pour le téléphone du senior ; l'extension indique le format du fichier. */
    public record ReminderAudio(SignedUrl url, String extension) {
    }

    /** Contexte de génération d'un message. */
    record MessageContext(UUID medicationId, UUID seniorId, Language langue, String texte, VoiceProfile voice) {
    }

    /** Renvoie le meilleur audio disponible pour ce traitement, en le générant si nécessaire. */
    public AudioResult audioForMedication(UUID medicationId) {
        MessageContext ctx = context(medicationId);
        AudioResult result = generate(ctx);
        if (result.asset() != null) {
            pruneObsolete(medicationId, result.asset());
        }
        return result;
    }

    /** Génération en tâche de fond (création / modification d'un traitement, voix devenue PRETE). */
    @Async(AsyncConfig.AUDIO_EXECUTOR)
    public void audioForMedicationAsync(UUID medicationId) {
        try {
            AudioResult result = audioForMedication(medicationId);
            log.debug("Audio du traitement prêt : source {}", result.source());
        } catch (RuntimeException e) {
            log.warn("Génération audio impossible : {}", e.getClass().getSimpleName());
        }
    }

    /**
     * Audio déjà en cache (sans appel au microservice) : utilisé au moment du rappel pour ne jamais
     * retarder la notification (ENF-05).
     */
    public Optional<SignedUrl> cachedSignedUrl(UUID medicationId) {
        return cachedReminderAudio(medicationId).map(ReminderAudio::url);
    }

    /** Audio du rappel : message cloné, sinon enregistrement de l'aidant, sinon rien (tonalité du téléphone). */
    public Optional<ReminderAudio> cachedReminderAudio(UUID medicationId) {
        MessageContext ctx = context(medicationId);
        if (ctx.voice() != null) {
            Optional<AudioAsset> cloned = assets.findCached(medicationId, ctx.texte(), ctx.langue(), ctx.voice().getId());
            if (cloned.isPresent()) {
                return cloned.map(this::reminderAudio);
            }
        }
        return voices.usableRecording(ctx.seniorId()).map(this::reminderAudio);
    }

    private ReminderAudio reminderAudio(AudioAsset asset) {
        return new ReminderAudio(signedUrl(asset), extensionOf(asset.getStorageKey()));
    }

    private ReminderAudio reminderAudio(VoiceProfile recording) {
        NeuroCareProperties.Storage config = properties.storage();
        String key = recording.getEchantillonKey();
        return new ReminderAudio(storage.signedGetUrl(config.voiceSamplesBucket(), key, config.signedUrlTtl()),
                extensionOf(key));
    }

    private static String extensionOf(String storageKey) {
        return storageKey.substring(storageKey.lastIndexOf('.') + 1);
    }

    public SignedUrl signedUrl(AudioAsset asset) {
        NeuroCareProperties.Storage config = properties.storage();
        return storage.signedGetUrl(config.audioAssetsBucket(), asset.getStorageKey(), config.signedUrlTtl());
    }

    public AudioAsset asset(UUID assetId) {
        return assets.findById(assetId).orElseThrow(() -> BusinessException.notFound("Audio introuvable."));
    }

    /** Senior concerné par un audio (pour {@code @PreAuthorize}) ; 404 s'il n'existe pas. */
    public UUID seniorIdOfAsset(UUID assetId) {
        AudioAsset asset = asset(assetId);
        if (asset.getMedicationId() == null) {
            throw BusinessException.notFound("Audio introuvable.");
        }
        return medicationService.seniorIdOf(asset.getMedicationId());
    }

    // ---------- Génération ----------

    AudioResult generate(MessageContext ctx) {
        if (ctx.voice() != null) {
            Optional<AudioAsset> cached = assets.findCached(ctx.medicationId(), ctx.texte(), ctx.langue(),
                    ctx.voice().getId());
            if (cached.isPresent()) {
                return new AudioResult(AudioSource.CLONE, cached.get(), ctx.texte());
            }
            Optional<AudioAsset> cloned = tryClone(ctx);
            if (cloned.isPresent()) {
                return new AudioResult(AudioSource.CLONE, cloned.get(), ctx.texte());
            }
        }
        return new AudioResult(AudioSource.PREENREGISTRE, null, ctx.texte());
    }

    private Optional<AudioAsset> tryClone(MessageContext ctx) {
        try {
            Synthesized audio = audioService.synthesize(ctx.voice().getProviderVoiceId(), ctx.texte(), ctx.langue());
            String key = ctx.medicationId() + "/" + UUID.randomUUID() + "." + audio.extension();
            storage.put(properties.storage().audioAssetsBucket(), key, audio.content(), audio.contentType());
            AudioAsset asset = new AudioAsset(ctx.medicationId(), ctx.voice().getId(), ctx.langue(),
                    ctx.texte(), AudioSource.CLONE, key);
            return Optional.of(assets.save(asset));
        } catch (AudioServiceRejectedException e) {
            log.info("Clonage refusé par le service audio ({})", e.code());
        } catch (AudioServiceUnavailableException e) {
            log.warn("Clonage indisponible ({})", e.getMessage());
        } catch (RuntimeException e) {
            log.warn("Clonage en échec ({})", e.getClass().getSimpleName());
        }
        return Optional.empty();
    }

    /** Supprime les audios devenus obsolètes (nom du traitement, surnom ou langue modifiés). */
    private void pruneObsolete(UUID medicationId, AudioAsset current) {
        for (AudioAsset old : assets.findByMedicationIdOrderByDateCreationDesc(medicationId)) {
            boolean sameMessage = old.getTexte().equals(current.getTexte()) && old.getLangue() == current.getLangue();
            if (!sameMessage) {
                try {
                    storage.delete(properties.storage().audioAssetsBucket(), old.getStorageKey());
                    assets.delete(old);
                } catch (RuntimeException e) {
                    log.warn("Audio obsolète non supprimé : {}", e.getClass().getSimpleName());
                }
            }
        }
    }

    private MessageContext context(UUID medicationId) {
        MedicationAudioInfo medication = medicationService.audioInfo(medicationId);
        SeniorAudioProfile senior = seniorService.audioProfile(medication.seniorId());
        VoiceProfile voice = voices.usableVoice(medication.seniorId()).orElse(null);

        // Surnom donné par l'aidant dont la voix parle, sinon par l'aidant qui a saisi le traitement.
        Optional<CaregiverLinkView> link = voice != null
                ? linkService.findLinkById(voice.getCaregiverLinkId())
                : linkService.findLink(medication.seniorId(), medication.creePar());
        String surnom = link.map(CaregiverLinkView::surnomSenior)
                .filter(s -> !s.isBlank())
                .orElse(senior.nomComplet());

        String texte = ReminderMessageTemplate.render(senior.langue(), surnom, medication.nomMedicament());
        return new MessageContext(medicationId, medication.seniorId(), senior.langue(), texte, voice);
    }
}
