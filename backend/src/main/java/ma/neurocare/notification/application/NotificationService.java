package ma.neurocare.notification.application;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.config.AsyncConfig;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.notification.application.PushNotificationService.PushMessage;
import ma.neurocare.notification.application.PushNotificationService.PushResult;
import ma.neurocare.reminder.application.ReminderEvents.DoseReminderDue;
import ma.neurocare.reminder.application.ReminderEvents.DoseStatusChanged;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.voice.application.AudioGenerationService;
import ma.neurocare.voice.domain.AudioSource;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage.SignedUrl;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Envoie les push après commit, de façon asynchrone (pool dédié) : un échec d'envoi n'annule jamais
 * l'état enregistré. Les rappels locaux du téléphone restent le filet de sécurité (EF-RE-06).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String DOSE_REMINDER = "DOSE_REMINDER";
    public static final String DOSE_NO_RESPONSE = "DOSE_NO_RESPONSE";

    private final PushNotificationService push;
    private final DeviceService deviceService;
    private final CaregiverLinkService linkService;
    private final AudioGenerationService audioGeneration;
    private final AlertPublisher alerts;

    /** Rappel au senior : le payload contient le nom du médicament pour l'affichage (cahier §9.3). */
    @Async(AsyncConfig.PUSH_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDoseReminderDue(DoseReminderDue event) {
        String audioUrl = audioUrlFor(event.medicationId());
        Map<String, String> data = Map.of(
                "doseId", event.doseId().toString(),
                "medication", event.nomMedicament() == null ? "" : event.nomMedicament(),
                "datePrevue", event.datePrevue().toString(),
                "relance", Boolean.toString(event.relance()),
                "audioUrl", audioUrl,
                // URL vide → l'application joue son audio générique embarqué (repli niveau 3).
                "audioSource", audioUrl.isEmpty() ? AudioSource.PREENREGISTRE.name() : "FICHIER");
        if (sendToUser(event.seniorId(), new PushMessage(DOSE_REMINDER, data))) {
            alerts.deviceUnreachable(event.seniorId());
        }
    }

    /**
     * Alerte aux aidants autorisés (lien validé + PARTAGE_FAMILIAL) quand une prise passe en SANS_REPONSE.
     * Payload minimal (identifiants seulement) : l'application recharge le détail via l'API.
     */
    @Async(AsyncConfig.PUSH_EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDoseStatusChanged(DoseStatusChanged event) {
        if (event.statut() != DoseStatus.SANS_REPONSE) {
            return;
        }
        Map<String, String> data = Map.of(
                "doseId", event.doseId().toString(),
                "seniorId", event.seniorId().toString(),
                "statut", event.statut().name(),
                "couleur", event.couleur());
        for (UUID aidantId : linkService.caregiversWithHealthAccess(event.seniorId())) {
            sendToUser(aidantId, new PushMessage(DOSE_NO_RESPONSE, data));
        }
    }

    /**
     * URL signée de l'audio déjà en cache. Aucune génération ici : le rappel ne doit jamais attendre le
     * service audio (ENF-05). Si rien n'est prêt, la génération est relancée pour les prochains rappels.
     */
    private String audioUrlFor(UUID medicationId) {
        if (medicationId == null) {
            return "";
        }
        try {
            Optional<SignedUrl> url = audioGeneration.cachedSignedUrl(medicationId);
            if (url.isEmpty()) {
                audioGeneration.audioForMedicationAsync(medicationId);
            }
            return url.map(SignedUrl::url).orElse("");
        } catch (RuntimeException e) {
            log.warn("URL audio indisponible : {}", e.getClass().getSimpleName());
            return "";
        }
    }

    /** @return {@code true} si un token a été refusé par FCM (appareil injoignable) */
    boolean sendToUser(UUID userId, PushMessage message) {
        List<String> tokens = deviceService.activeFcmTokens(userId);
        if (tokens.isEmpty()) {
            log.debug("Aucun appareil joignable pour un message {}", message.type());
            return false;
        }
        boolean invalidToken = false;
        for (String token : tokens) {
            try {
                if (push.send(token, message) == PushResult.INVALID_TOKEN) {
                    deviceService.forgetFcmToken(token);
                    invalidToken = true;
                }
            } catch (RuntimeException e) {
                log.warn("Échec d'envoi push {} : {}", message.type(), e.getClass().getSimpleName());
            }
        }
        return invalidToken;
    }
}
