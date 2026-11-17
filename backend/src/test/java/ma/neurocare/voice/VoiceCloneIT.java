package ma.neurocare.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import ma.neurocare.AbstractIntegrationTest;
import ma.neurocare.voice.domain.AudioSampleInspectorTest;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Parcours complet avec un faux microservice audio (contrat §10.1) : upload → PRET → message cloné
 * (niveau 1) → URL signée 5 min → révocation VOIX → voix supprimée côté service, retour au TTS (niveau 2).
 */
class VoiceCloneIT extends AbstractIntegrationTest {

    private static final String KEY = "test-internal-key";
    private static final List<String> deletedVoices = new CopyOnWriteArrayList<>();
    private static final List<String> receivedKeys = new CopyOnWriteArrayList<>();
    private static final HttpServer FAKE_AUDIO_SERVICE = startFakeService();

    @DynamicPropertySource
    static void audioService(DynamicPropertyRegistry registry) {
        registry.add("neurocare.audio.base-url",
                () -> "http://127.0.0.1:" + FAKE_AUDIO_SERVICE.getAddress().getPort());
    }

    @AfterAll
    static void stopFakeService() {
        FAKE_AUDIO_SERVICE.stop(0);
    }

    @Test
    void clonedVoiceEndToEndThenRevocationFallsBackToStandardTts() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);
        for (String type : List.of("PARTAGE_FAMILIAL", "RAPPELS", "VOIX")) {
            giveConsent(aidant, seniorId, type, true);
        }
        String medicationId = createMedication(aidant, seniorId);

        mvc.perform(bearer(multipart("/api/v1/seniors/{id}/voice-profile", seniorId)
                        .file(new MockMultipartFile("file", "salma.wav", "audio/wav", AudioSampleInspectorTest.wav(12))),
                        aidant))
                .andExpect(status().isAccepted());
        awaitUntil("profil PRET", () -> "PRET".equals(profileStatus(aidant, seniorId)));

        // Niveau 1 : voix de l'aidante.
        MvcResult preview = mvc.perform(bearer(post("/api/v1/medications/{id}/audio/preview", medicationId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("CLONE"))
                .andReturn();
        String url = read(preview, "$.url");
        String assetId = read(preview, "$.assetId");

        // L'URL signée donne le fichier sans authentification…
        byte[] audio = mvc.perform(get(URI.create(url))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsByteArray();
        assertThat(new String(audio, StandardCharsets.UTF_8)).startsWith("CLONE:voice-1:Baba");
        // … mais pas si elle est altérée.
        mvc.perform(get(URI.create(url.replace("sig=", "sig=0")))).andExpect(status().isForbidden());

        // Le senior obtient une nouvelle URL signée pour cet audio.
        String senior = pairDevice(aidant, seniorId);
        mvc.perform(bearer(get("/api/v1/audio/{id}", assetId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.containsString("sig=")));
        assertThat(receivedKeys).containsOnly(KEY);

        // EF-CO-05 : révocation de VOIX → profil et voix distante supprimés, audio cloné effacé.
        giveConsent(aidant, seniorId, "VOIX", false);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/voice-profile", seniorId), aidant))
                .andExpect(status().isNotFound());
        awaitUntil("voix supprimée côté service", () -> deletedVoices.contains("voice-1"));
        mvc.perform(bearer(get("/api/v1/audio/{id}", assetId), senior)).andExpect(status().isNotFound());

        // Niveau 2 : TTS standard.
        mvc.perform(bearer(post("/api/v1/medications/{id}/audio/preview", medicationId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("TTS_STANDARD"));
    }

    private String profileStatus(String aidant, String seniorId) throws Exception {
        MvcResult result = mvc.perform(bearer(get("/api/v1/seniors/{id}/voice-profile", seniorId), aidant)).andReturn();
        return result.getResponse().getStatus() == 200 ? read(result, "$.statut") : null;
    }

    private String createMedication(String aidant, String seniorId) throws Exception {
        MvcResult result = mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomMedicament", "Metformine 500",
                                "dateDebut", LocalDate.now(ZoneId.of("Africa/Casablanca")).toString(),
                                "horaires", List.of(Map.of("heure", "08:00", "jours", List.of("LUN")))))))
                .andExpect(status().isCreated())
                .andReturn();
        return read(result, "$.id");
    }

    // ---------- Faux microservice audio ----------

    private static HttpServer startFakeService() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/voices", exchange -> {
                receivedKeys.add(exchange.getRequestHeaders().getFirst("X-Internal-Key"));
                exchange.getRequestBody().readAllBytes();
                if ("DELETE".equals(exchange.getRequestMethod())) {
                    String path = exchange.getRequestURI().getPath();
                    deletedVoices.add(path.substring(path.lastIndexOf('/') + 1));
                    respond(exchange, 204, "application/json", "");
                } else {
                    respond(exchange, 201, "application/json", "{\"voiceId\":\"voice-1\",\"status\":\"READY\"}");
                }
            });
            server.createContext("/synthesize", exchange -> {
                receivedKeys.add(exchange.getRequestHeaders().getFirst("X-Internal-Key"));
                String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                String text = body.replaceAll(".*\"text\":\"([^\"]*)\".*", "$1");
                String prefix = body.contains("\"voiceId\":\"voice-1\"") ? "CLONE:voice-1:" : "TTS:";
                respond(exchange, 200, "audio/mpeg", prefix + text);
            });
            server.start();
            return server;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void respond(HttpExchange exchange, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", type);
        exchange.sendResponseHeaders(status, status == 204 ? -1 : bytes.length);
        if (status != 204) {
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        }
        exchange.close();
    }
}
