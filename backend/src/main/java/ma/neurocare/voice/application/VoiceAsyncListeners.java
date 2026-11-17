package ma.neurocare.voice.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.config.AsyncConfig;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.medication.application.MedicationChangedEvent;
import ma.neurocare.voice.application.VoiceEvents.VoiceDataPurgeRequested;
import ma.neurocare.voice.application.VoiceEvents.VoiceSampleUploaded;
import ma.neurocare.voice.infrastructure.AudioServiceClient;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Travaux audio déclenchés après commit, hors du thread de la requête : un service audio lent ou en
 * panne ne retarde ni l'API ni le moteur de rappel.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VoiceAsyncListeners {

    private final VoiceService voiceService;
    private final AudioGenerationService audioGeneration;
    private final AudioServiceClient audioService;
    private final ObjectStorage storage;
    private final NeuroCareProperties properties;

    @Async(AsyncConfig.AUDIO_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSampleUploaded(VoiceSampleUploaded event) {
        voiceService.enroll(event.voiceProfileId(), event.seniorId());
    }

    /** EF-VO-03 : message généré (et mis en cache) dès la création ou la modification d'un traitement. */
    @Async(AsyncConfig.AUDIO_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMedicationChanged(MedicationChangedEvent event) {
        if (event.kind() == MedicationChangedEvent.Kind.DEACTIVATED) {
            return;
        }
        try {
            audioGeneration.audioForMedication(event.medicationId());
        } catch (RuntimeException e) {
            log.warn("Génération audio impossible : {}", e.getClass().getSimpleName());
        }
    }

    /** EF-CO-05 : effacement des fichiers vocaux et de la voix côté microservice. */
    @Async(AsyncConfig.AUDIO_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPurge(VoiceDataPurgeRequested event) {
        NeuroCareProperties.Storage config = properties.storage();
        event.sampleKeys().forEach(key -> deleteQuietly(config.voiceSamplesBucket(), key));
        event.assetKeys().forEach(key -> deleteQuietly(config.audioAssetsBucket(), key));
        for (String voiceId : event.providerVoiceIds()) {
            try {
                audioService.deleteVoice(voiceId);
            } catch (RuntimeException e) {
                log.warn("Voix distante non supprimée ({}) : à purger manuellement", e.getClass().getSimpleName());
            }
        }
    }

    private void deleteQuietly(String bucket, String key) {
        try {
            storage.delete(bucket, key);
        } catch (RuntimeException e) {
            log.warn("Fichier vocal non supprimé ({}) : à purger manuellement", e.getClass().getSimpleName());
        }
    }
}
