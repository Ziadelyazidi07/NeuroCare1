package ma.neurocare.notification.infrastructure;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.notification.application.PushNotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Firebase Cloud Messaging via l'API HTTP v1 (cahier §9.3) : message data, priorité haute Android.
 *
 * <p>Sans SDK Firebase : le jeton OAuth2 est obtenu en signant (RS256) une assertion avec la clé du
 * compte de service, lue dans le fichier pointé par {@code GOOGLE_APPLICATION_CREDENTIALS}
 * (secret Docker, jamais dans Git). Le jeton est mis en cache jusqu'à 5 min avant son expiration.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "neurocare.push.provider", havingValue = "fcm")
public class FcmPushNotificationService implements PushNotificationService {

    static final String ANDROID_CHANNEL = "rappels_medicaments";
    private static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    private static final String DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final Duration ASSERTION_TTL = Duration.ofHours(1);
    private static final Duration REFRESH_MARGIN = Duration.ofMinutes(5);

    private final RestClient http;
    private final Clock clock;
    private final String projectId;
    private final String clientEmail;
    private final String tokenUri;
    private final PrivateKey privateKey;

    private String accessToken;
    private Instant accessTokenExpiry = Instant.EPOCH;

    public FcmPushNotificationService(RestClient.Builder builder, ObjectMapper json, Clock clock,
                                      @Value("${GOOGLE_APPLICATION_CREDENTIALS:}") String credentialsPath)
            throws IOException {
        if (credentialsPath.isBlank()) {
            throw new IllegalStateException(
                    "neurocare.push.provider=fcm exige GOOGLE_APPLICATION_CREDENTIALS (compte de service Firebase).");
        }
        JsonNode account = json.readTree(Files.readString(Path.of(credentialsPath)));
        this.projectId = account.path("project_id").asText();
        this.clientEmail = account.path("client_email").asText();
        this.tokenUri = account.path("token_uri").asText(DEFAULT_TOKEN_URI);
        this.privateKey = parsePkcs8(account.path("private_key").asText());
        this.http = builder.build();
        this.clock = clock;
    }

    @Override
    public PushResult send(String fcmToken, PushMessage message) {
        Map<String, String> data = new HashMap<>(message.data());
        data.put("type", message.type());
        data.put("channelId", ANDROID_CHANNEL);
        Map<String, Object> body = Map.of("message", Map.of(
                "token", fcmToken,
                "data", data,
                "android", Map.of("priority", "HIGH")));
        try {
            http.post()
                    .uri("https://fcm.googleapis.com/v1/projects/{project}/messages:send", projectId)
                    .headers(h -> h.setBearerAuth(accessToken()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            return PushResult.SENT;
        } catch (HttpClientErrorException e) {
            // 404 UNREGISTERED ou 400 INVALID_ARGUMENT : token périmé ou invalide.
            if (e.getStatusCode().value() == 404 || e.getStatusCode().value() == 400) {
                return PushResult.INVALID_TOKEN;
            }
            log.warn("Échec d'envoi FCM ({}) pour un message {}", e.getStatusCode().value(), message.type());
            return PushResult.FAILED;
        } catch (RestClientException e) {
            log.warn("FCM injoignable pour un message {} : {}", message.type(), e.getClass().getSimpleName());
            return PushResult.FAILED;
        }
    }

    private synchronized String accessToken() {
        Instant now = clock.instant();
        if (accessToken != null && now.isBefore(accessTokenExpiry.minus(REFRESH_MARGIN))) {
            return accessToken;
        }
        String assertion = Jwts.builder()
                .issuer(clientEmail)
                .audience().add(tokenUri).and()
                .claim("scope", SCOPE)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ASSERTION_TTL)))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
        form.add("assertion", assertion);
        JsonNode response = http.post()
                .uri(tokenUri)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(JsonNode.class);
        if (response == null || !response.hasNonNull("access_token")) {
            throw new IllegalStateException("Réponse OAuth2 Google invalide");
        }
        accessToken = response.get("access_token").asText();
        accessTokenExpiry = now.plusSeconds(response.path("expires_in").asLong(3600));
        return accessToken;
    }

    static PrivateKey parsePkcs8(String pem) {
        try {
            String base64 = pem.replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            return KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (Exception e) {
            throw new IllegalStateException("Clé privée du compte de service Firebase illisible", e);
        }
    }
}
