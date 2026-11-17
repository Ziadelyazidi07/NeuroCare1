package ma.neurocare.notification.application;

import java.time.Clock;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.cognitive.application.CognitiveSessionCompleted;
import ma.neurocare.notification.api.dto.RealtimeMessages;
import ma.neurocare.notification.api.dto.RealtimeMessages.CognitiveSessionMessage;
import ma.neurocare.notification.api.dto.RealtimeMessages.DeviceUnreachableMessage;
import ma.neurocare.notification.api.dto.RealtimeMessages.DoseStatusChangedMessage;
import ma.neurocare.notification.api.dto.RealtimeMessages.VoiceProfileMessage;
import ma.neurocare.reminder.application.ReminderEvents.DoseStatusChanged;
import ma.neurocare.voice.application.VoiceEvents.VoiceProfileStatusChanged;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Publie les événements métier sur {@code /topic/seniors/{seniorId}/events} après commit (cahier §9.4) :
 * l'aidant ne voit jamais un état qui serait ensuite annulé. Envoi synchrone vers le broker en mémoire
 * pour tenir la cible « < 2 s » (ENF-03, CA-02). Le filtrage par abonné est fait par
 * {@code StompSecurityInterceptor}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertPublisher {

    private final SimpMessagingTemplate messaging;
    private final Clock clock;

    public static String topicOf(UUID seniorId) {
        return "/topic/seniors/" + seniorId + "/events";
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onDoseStatusChanged(DoseStatusChanged event) {
        publish(event.seniorId(), new DoseStatusChangedMessage(RealtimeMessages.DOSE_STATUS_CHANGED, event.doseId(),
                event.seniorId(), event.nomMedicament(), event.datePrevue(), event.statut(), event.couleur()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onCognitiveSessionCompleted(CognitiveSessionCompleted event) {
        publish(event.seniorId(), new CognitiveSessionMessage(RealtimeMessages.COGNITIVE_SESSION_COMPLETED,
                event.sessionId(), event.seniorId(), event.typeExercice(), event.dateExercice(), event.interrompu()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onVoiceProfileStatusChanged(VoiceProfileStatusChanged event) {
        publish(event.seniorId(), new VoiceProfileMessage(RealtimeMessages.VOICE_PROFILE_READY,
                event.voiceProfileId(), event.seniorId(), event.statut()));
    }

    /** Token FCM du téléphone senior refusé : l'aidant en est informé (cahier §9.3). */
    public void deviceUnreachable(UUID seniorId) {
        publish(seniorId, new DeviceUnreachableMessage(RealtimeMessages.DEVICE_UNREACHABLE, seniorId, clock.instant()));
    }

    private void publish(UUID seniorId, Object payload) {
        try {
            messaging.convertAndSend(topicOf(seniorId), payload);
        } catch (RuntimeException e) {
            // Le temps réel est un confort : son échec ne doit jamais casser l'opération métier.
            log.warn("Publication temps réel impossible : {}", e.getClass().getSimpleName());
        }
    }
}
