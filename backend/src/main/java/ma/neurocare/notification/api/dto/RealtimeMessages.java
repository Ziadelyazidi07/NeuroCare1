package ma.neurocare.notification.api.dto;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.cognitive.domain.ExerciseType;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.voice.domain.VoiceProfileStatus;

/**
 * Messages publiés sur {@code /topic/seniors/{seniorId}/events} (cahier §9.4). Le champ {@code type}
 * permet à l'application de router le message. Aucun résultat d'exercice n'y figure : l'aidant recharge
 * le détail via l'API (contrôle d'accès et audit).
 */
public final class RealtimeMessages {

    public static final String DOSE_STATUS_CHANGED = "DOSE_STATUS_CHANGED";
    public static final String COGNITIVE_SESSION_COMPLETED = "COGNITIVE_SESSION_COMPLETED";
    public static final String VOICE_PROFILE_READY = "VOICE_PROFILE_READY";
    public static final String DEVICE_UNREACHABLE = "DEVICE_UNREACHABLE";

    private RealtimeMessages() {
    }

    public record DoseStatusChangedMessage(String type, UUID doseId, UUID seniorId, String medication,
                                           Instant datePrevue, DoseStatus statut, String couleur) {
    }

    public record CognitiveSessionMessage(String type, UUID sessionId, UUID seniorId, ExerciseType typeExercice,
                                          Instant dateExercice, boolean interrompu) {
    }

    public record VoiceProfileMessage(String type, UUID voiceProfileId, UUID seniorId, VoiceProfileStatus statut) {
    }

    public record DeviceUnreachableMessage(String type, UUID seniorId, Instant detecteLe) {
    }
}
