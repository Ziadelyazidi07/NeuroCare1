package ma.neurocare.voice.infrastructure;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeoutException;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;
import io.github.resilience4j.timelimiter.TimeLimiter;
import io.github.resilience4j.timelimiter.TimeLimiterRegistry;
import jakarta.annotation.PreDestroy;
import ma.neurocare.common.domain.Language;
import ma.neurocare.config.NeuroCareProperties;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Client du microservice audio interne (cahier §10.1-10.2), authentifié par {@code X-Internal-Key}.
 *
 * <p>Chaque appel est protégé par Resilience4j, dans l'ordre Retry(CircuitBreaker(TimeLimiter(appel))) :
 * <ul>
 *   <li>TimeLimiter : abandon au-delà de {@code neurocare.audio.timeout} (20 s) ;</li>
 *   <li>CircuitBreaker : après une série d'échecs, les appels échouent immédiatement pendant 30 s ;</li>
 *   <li>Retry : une seconde tentative pour les pannes transitoires.</li>
 * </ul>
 * Les refus métier (4xx) ne sont ni réessayés ni comptés comme pannes. Configuration : {@code resilience4j.*.audio}.
 *
 * <p>Utilisation programmatique (et non par annotations) : {@code @TimeLimiter} ne s'applique qu'aux
 * méthodes asynchrones ; ici la limite de temps couvre bien chaque appel synchrone.
 */
@Component
public class AudioServiceClient {

    static final String INSTANCE = "audio";
    static final String INTERNAL_KEY_HEADER = "X-Internal-Key";

    private final RestClient http;
    private final CircuitBreaker circuitBreaker;
    private final Retry retry;
    private final TimeLimiter timeLimiter;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /** Audio produit par le service. */
    public record Synthesized(byte[] content, String contentType) {

        public String extension() {
            return contentType != null && contentType.contains("wav") ? "wav" : "mp3";
        }
    }

    /** Corps de POST /synthesize ({@code voiceId} omis → TTS standard). */
    record SynthesizeRequest(String voiceId, String text, String language) {
    }

    /** Résultat de l'enrôlement d'une voix : {@code voiceId} nul si le clonage est indisponible. */
    public record Enrollment(String voiceId, boolean ready, String reason) {
    }

    public AudioServiceClient(RestClient.Builder builder, NeuroCareProperties properties,
                              CircuitBreakerRegistry circuitBreakers, RetryRegistry retries,
                              TimeLimiterRegistry timeLimiters) {
        NeuroCareProperties.Audio audio = properties.audio();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(2))
                .build());
        factory.setReadTimeout(audio.timeout());
        this.http = builder.clone()
                .baseUrl(audio.baseUrl())
                .requestFactory(factory)
                .defaultHeader(INTERNAL_KEY_HEADER, audio.internalKey() == null ? "" : audio.internalKey())
                .build();
        this.circuitBreaker = circuitBreakers.circuitBreaker(INSTANCE);
        this.retry = retries.retry(INSTANCE);
        this.timeLimiter = timeLimiters.timeLimiter(INSTANCE);
    }

    /** POST /synthesize : voix clonée si {@code voiceId} est renseigné, sinon TTS standard. */
    public Synthesized synthesize(String voiceId, String text, Language language) {
        return call(() -> {
            ResponseEntity<byte[]> response = http.post()
                    .uri("/synthesize")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new SynthesizeRequest(voiceId, text, language.code()))
                    .retrieve()
                    .toEntity(byte[].class);
            byte[] body = response.getBody();
            if (body == null || body.length == 0) {
                throw new IllegalStateException("Réponse audio vide");
            }
            MediaType type = response.getHeaders().getContentType();
            return new Synthesized(body, type == null ? "audio/mpeg" : type.toString());
        });
    }

    /** POST /voices : transmet l'échantillon au service, qui crée le profil vocal (EF-VO-02). */
    public Enrollment enrollVoice(byte[] sample, String filename, Language language) {
        return call(() -> {
            MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
            form.add("file", new ByteArrayResource(sample) {
                @Override
                public String getFilename() {
                    return filename;
                }
            });
            form.add("language", language.code());
            JsonNode json = http.post()
                    .uri("/voices")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            if (json == null) {
                throw new IllegalStateException("Réponse vide");
            }
            boolean ready = "READY".equals(json.path("status").asText());
            String voiceId = json.hasNonNull("voiceId") ? json.get("voiceId").asText() : null;
            return new Enrollment(ready ? voiceId : null, ready && voiceId != null, json.path("reason").asText(null));
        });
    }

    /** DELETE /voices/{voiceId} (idempotent côté service). */
    public void deleteVoice(String voiceId) {
        call(() -> {
            http.delete().uri("/voices/{id}", voiceId).retrieve().toBodilessEntity();
            return null;
        });
    }

    public CircuitBreaker.State circuitState() {
        return circuitBreaker.getState();
    }

    private <T> T call(Callable<T> request) {
        Callable<T> timeLimited = () -> timeLimiter.executeFutureSupplier(() -> executor.submit(() -> {
            try {
                return request.call();
            } catch (HttpClientErrorException e) {
                throw rejected(e);
            }
        }));
        Callable<T> guarded = Retry.decorateCallable(retry, CircuitBreaker.decorateCallable(circuitBreaker, timeLimited));
        try {
            return guarded.call();
        } catch (AudioServiceRejectedException e) {
            throw e;
        } catch (CallNotPermittedException e) {
            throw new AudioServiceUnavailableException("Disjoncteur ouvert : service audio considéré indisponible", e);
        } catch (TimeoutException e) {
            throw new AudioServiceUnavailableException("Service audio trop lent", e);
        } catch (Exception e) {
            throw new AudioServiceUnavailableException("Service audio indisponible : " + e.getClass().getSimpleName(), e);
        }
    }

    private static AudioServiceRejectedException rejected(HttpClientErrorException e) {
        HttpStatusCode status = e.getStatusCode();
        String code = "UNKNOWN";
        try {
            JsonNode body = e.getResponseBodyAs(JsonNode.class);
            if (body != null && body.hasNonNull("code")) {
                code = body.get("code").asText();
            }
        } catch (RuntimeException ignored) {
            // corps non JSON : code inconnu
        }
        return new AudioServiceRejectedException(status.value(), code);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
