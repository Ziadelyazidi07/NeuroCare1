package ma.neurocare.notification.application;

import java.util.Map;

/**
 * Envoi d'un message push à un appareil. Implémentations :
 * <ul>
 *   <li>{@code LoggingPushNotificationService} — factice, journalise sans donnée de santé
 *       ({@code neurocare.push.provider=log}, défaut en dev / demo / test) ;</li>
 *   <li>{@code FcmPushNotificationService} — Firebase Cloud Messaging ({@code provider=fcm}).</li>
 * </ul>
 */
public interface PushNotificationService {

    PushResult send(String fcmToken, PushMessage message);

    /**
     * Message de type data (cahier §9.3) : l'application lit l'audio et affiche le gros bouton elle-même.
     *
     * @param type identifiant du message (DOSE_REMINDER, DOSE_NO_RESPONSE…)
     * @param data charge utile (valeurs texte)
     */
    record PushMessage(String type, Map<String, String> data) {
    }

    enum PushResult {
        SENT,
        /** Token inconnu ou expiré : l'appareil ne recevra plus rien, il faut l'oublier. */
        INVALID_TOKEN,
        FAILED
    }
}
