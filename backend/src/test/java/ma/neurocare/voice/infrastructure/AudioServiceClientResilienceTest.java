package ma.neurocare.voice.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import io.github.resilience4j.timelimiter.TimeLimiterConfig;
import io.github.resilience4j.timelimiter.TimeLimiterRegistry;
import ma.neurocare.common.domain.Language;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.voice.infrastructure.AudioServiceClient.Synthesized;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/**
 * Résilience du client audio contre un vrai serveur HTTP local (cahier §10.2, §14.1 « repli quand le
 * service est lent ou en erreur ») : Retry, TimeLimiter, CircuitBreaker et refus métier.
 */
class AudioServiceClientResilienceTest {

    private static final String KEY = "cle-interne-test";

    /** Comportement du faux service, modifiable par test. */
    private enum Mode { OK, ERROR_500, SLOW, REJECT_422 }

    private final AtomicReference<Mode> mode = new AtomicReference<>(Mode.OK);
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicReference<String> lastKey = new AtomicReference<>();
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private final AtomicReference<String> lastUpgrade = new AtomicReference<>("non lu");

    private HttpServer server;
    private AudioServiceClient client;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/synthesize", this::handle);
        server.start();

        NeuroCareProperties properties = new NeuroCareProperties(ZoneId.of("UTC"), null, null,
                new NeuroCareProperties.Audio("http://127.0.0.1:" + server.getAddress().getPort(), KEY,
                        Duration.ofSeconds(5)),
                null, null);
        CircuitBreakerRegistry circuitBreakers = CircuitBreakerRegistry.of(CircuitBreakerConfig.custom()
                .slidingWindowSize(4)
                .minimumNumberOfCalls(4)
                .failureRateThreshold(50)
                .waitDurationInOpenState(Duration.ofMinutes(1))
                .ignoreExceptions(AudioServiceRejectedException.class)
                .build());
        RetryRegistry retries = RetryRegistry.of(RetryConfig.custom()
                .maxAttempts(2)
                .waitDuration(Duration.ofMillis(10))
                .ignoreExceptions(AudioServiceRejectedException.class, CallNotPermittedException.class)
                .build());
        TimeLimiterRegistry timeLimiters = TimeLimiterRegistry.of(TimeLimiterConfig.custom()
                .timeoutDuration(Duration.ofMillis(300))
                .cancelRunningFuture(true)
                .build());
        client = new AudioServiceClient(RestClient.builder(), properties, circuitBreakers, retries, timeLimiters);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void successSendsInternalKeyAndJsonBody() {
        Synthesized audio = client.synthesize(null, "Bonjour", Language.FR);

        assertThat(audio.content()).containsExactly("MP3".getBytes(StandardCharsets.UTF_8));
        assertThat(audio.contentType()).isEqualTo("audio/mpeg");
        assertThat(audio.extension()).isEqualTo("mp3");
        assertThat(lastKey.get()).isEqualTo(KEY);
        assertThat(lastBody.get()).contains("\"text\":\"Bonjour\"").contains("\"language\":\"fr\"");
        assertThat(calls.get()).isEqualTo(1);
        // Régression : pas de demande de passage en HTTP/2 (h2c), refusée par uvicorn.
        assertThat(lastUpgrade.get()).isNull();
    }

    @Test
    void serverErrorIsRetriedOnceThenReportedUnavailable() {
        mode.set(Mode.ERROR_500);

        assertThatThrownBy(() -> client.synthesize(null, "x", Language.FR))
                .isInstanceOf(AudioServiceUnavailableException.class);
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void slowServiceIsCutByTimeLimiter() {
        mode.set(Mode.SLOW);
        long start = System.nanoTime();

        assertThatThrownBy(() -> client.synthesize(null, "x", Language.FR))
                .isInstanceOf(AudioServiceUnavailableException.class)
                .hasMessageContaining("trop lent");
        // 2 tentatives de 300 ms au plus, bien avant les 2 s de réponse du serveur.
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofMillis(1500));
    }

    @Test
    void businessRejectionIsNeitherRetriedNorCountedAsFailure() {
        mode.set(Mode.REJECT_422);

        for (int i = 0; i < 6; i++) {
            assertThatThrownBy(() -> client.synthesize(null, "x", Language.DARIJA))
                    .isInstanceOf(AudioServiceRejectedException.class)
                    .satisfies(e -> assertThat(((AudioServiceRejectedException) e).code())
                            .isEqualTo("UNSUPPORTED_LANGUAGE"));
        }
        assertThat(calls.get()).isEqualTo(6);
        assertThat(client.circuitState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Test
    void circuitOpensAfterRepeatedFailuresAndThenFailsFastWithoutCallingTheService() {
        mode.set(Mode.ERROR_500);
        for (int i = 0; i < 2; i++) { // 2 appels × 2 tentatives = 4 échecs enregistrés
            assertThatThrownBy(() -> client.synthesize(null, "x", Language.FR))
                    .isInstanceOf(AudioServiceUnavailableException.class);
        }
        assertThat(client.circuitState()).isEqualTo(CircuitBreaker.State.OPEN);
        int callsWhenOpened = calls.get();

        mode.set(Mode.OK); // même rétabli, le service n'est plus sollicité tant que le circuit est ouvert
        assertThatThrownBy(() -> client.synthesize(null, "x", Language.FR))
                .isInstanceOf(AudioServiceUnavailableException.class)
                .hasMessageContaining("Disjoncteur ouvert");
        assertThat(calls.get()).isEqualTo(callsWhenOpened);
    }

    private void handle(HttpExchange exchange) throws IOException {
        calls.incrementAndGet();
        lastKey.set(exchange.getRequestHeaders().getFirst("X-Internal-Key"));
        lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        lastUpgrade.set(exchange.getRequestHeaders().getFirst("Upgrade"));
        switch (mode.get()) {
            case OK -> respond(exchange, 200, "audio/mpeg", "MP3");
            case ERROR_500 -> respond(exchange, 500, "application/json", "{\"code\":\"ENGINE_UNAVAILABLE\"}");
            case REJECT_422 -> respond(exchange, 422, "application/json", "{\"code\":\"UNSUPPORTED_LANGUAGE\"}");
            case SLOW -> {
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                respond(exchange, 200, "audio/mpeg", "MP3");
            }
        }
    }

    private static void respond(HttpExchange exchange, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", type);
        try {
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        } catch (IOException ignored) {
            // client parti (délai dépassé)
        }
    }
}
