package ma.neurocare.notification.infrastructure;

import lombok.extern.slf4j.Slf4j;
import ma.neurocare.notification.application.PushNotificationService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Implémentation factice : n'envoie rien, journalise le type de message et un token masqué.
 * Aucune donnée de santé (nom du médicament…) n'est écrite dans les journaux (cahier §8.4).
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "neurocare.push.provider", havingValue = "log", matchIfMissing = true)
public class LoggingPushNotificationService implements PushNotificationService {

    @Override
    public PushResult send(String fcmToken, PushMessage message) {
        log.info("[push factice] {} doseId={} → appareil …{}", message.type(), message.data().get("doseId"),
                mask(fcmToken));
        return PushResult.SENT;
    }

    static String mask(String token) {
        return token == null || token.length() < 6 ? "******" : token.substring(token.length() - 6);
    }
}
