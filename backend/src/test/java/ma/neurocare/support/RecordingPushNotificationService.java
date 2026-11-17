package ma.neurocare.support;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import ma.neurocare.notification.application.PushNotificationService;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Service push de test : n'envoie rien, enregistre chaque message (token, type, données) pour que les
 * tests vérifient ce qui serait parti vers les téléphones.
 */
public class RecordingPushNotificationService implements PushNotificationService {

    public record Sent(String token, String type, java.util.Map<String, String> data) {
    }

    private final List<Sent> sent = new CopyOnWriteArrayList<>();

    @Override
    public PushResult send(String fcmToken, PushMessage message) {
        sent.add(new Sent(fcmToken, message.type(), message.data()));
        return PushResult.SENT;
    }

    public List<Sent> sentTo(String token) {
        return sent.stream().filter(s -> s.token().equals(token)).toList();
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class Config {

        @Bean
        @Primary
        RecordingPushNotificationService recordingPushNotificationService() {
            return new RecordingPushNotificationService();
        }
    }
}
