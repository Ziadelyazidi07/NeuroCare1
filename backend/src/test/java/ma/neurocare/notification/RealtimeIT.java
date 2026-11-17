package ma.neurocare.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Type;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import com.fasterxml.jackson.databind.ObjectMapper;
import ma.neurocare.AbstractIntegrationTest;
import ma.neurocare.reminder.application.ReminderService;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.reminder.infrastructure.DoseEventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * Temps réel de bout en bout sur un vrai serveur (cahier §9.4, §14.1) : CA-02 (pastille verte en moins
 * de 2 s), alerte orange, refus d'un aidant non lié, coupure à la révocation de PARTAGE_FAMILIAL.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimeIT extends AbstractIntegrationTest {

    private static final ZoneId CASABLANCA = ZoneId.of("Africa/Casablanca");

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    ReminderService reminderService;

    @Autowired
    DoseEventRepository doseRepository;

    private WebSocketStompClient stompClient;

    @AfterEach
    void stopClient() {
        if (stompClient != null) {
            stompClient.stop();
        }
    }

    @Test
    void caregiverSeesGreenPillWithinTwoSecondsThenOrangeAlert() throws Exception {
        Fixture f = fixture();
        Client client = connect("Bearer " + f.aidant);
        BlockingQueue<Map<String, Object>> events = client.subscribe(f.seniorId);

        // CA-02 : « C'est fait » → pastille verte en direct.
        DoseEvent first = f.pending.get(0);
        long start = System.nanoTime();
        confirm(f, first.getId());
        Map<String, Object> green = events.poll(2, TimeUnit.SECONDS);
        assertThat(green).as("événement reçu en moins de 2 s").isNotNull();
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
        assertThat(green).containsEntry("type", "DOSE_STATUS_CHANGED")
                .containsEntry("doseId", first.getId().toString())
                .containsEntry("statut", "CONFIRME")
                .containsEntry("couleur", "VERT")
                .containsEntry("medication", "Metformine 500");
        assertThat(green.get("datePrevue")).isInstanceOf(String.class); // ISO-8601, comme l'API REST

        // CA-03 : clôture SANS_REPONSE → alerte orange.
        DoseEvent second = f.pending.get(1);
        reminderService.closeExpired(second.getDatePrevue().plus(Duration.ofMinutes(31)));
        Map<String, Object> orange = nextFor(events, second.getId());
        assertThat(orange).containsEntry("statut", "SANS_REPONSE").containsEntry("couleur", "ORANGE");
    }

    @Test
    void revokingFamilySharingStopsDeliveryToAnAlreadySubscribedCaregiver() throws Exception {
        Fixture f = fixture();
        Client client = connect("Bearer " + f.aidant);
        BlockingQueue<Map<String, Object>> events = client.subscribe(f.seniorId);

        giveConsent(f.aidant, f.seniorId, "PARTAGE_FAMILIAL", false); // EF-CO-04
        confirm(f, f.pending.get(0).getId());

        assertThat(events.poll(1500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void seniorReceivesOwnEventsWithDeviceToken() throws Exception {
        Fixture f = fixture();
        Client client = connect("Bearer " + f.senior);
        BlockingQueue<Map<String, Object>> events = client.subscribe(f.seniorId);

        confirm(f, f.pending.get(0).getId());

        assertThat(events.poll(2, TimeUnit.SECONDS)).containsEntry("couleur", "VERT");
    }

    @Test
    void unlinkedCaregiverSubscriptionIsRejected() throws Exception {
        Fixture f = fixture();
        Client stranger = connect("Bearer " + newAidantToken());
        BlockingQueue<Map<String, Object>> events = stranger.subscribe(f.seniorId);

        assertThat(stranger.errors.poll(3, TimeUnit.SECONDS)).as("trame ERROR").isNotNull();
        confirm(f, f.pending.get(0).getId());
        assertThat(events.poll(1, TimeUnit.SECONDS)).isNull();
    }

    @Test
    void connectionWithoutValidTokenIsRejected() throws Exception {
        for (String header : new String[]{null, "Bearer pas-un-jwt", "Bearer ncd_inconnu"}) {
            Client client = new Client();
            CompletableFuture<StompSession> future = client.connectAsync(header);
            boolean rejected;
            try {
                StompSession session = future.get(5, TimeUnit.SECONDS);
                rejected = client.errors.poll(3, TimeUnit.SECONDS) != null || !session.isConnected();
            } catch (Exception e) {
                rejected = true;
            }
            assertThat(rejected).as("CONNECT refusé pour " + header).isTrue();
        }
    }

    // ---------- Données ----------

    private record Fixture(String aidant, String senior, String seniorId, List<DoseEvent> pending) {
    }

    /** Aidant au lien validé (PARTAGE_FAMILIAL + RAPPELS), senior appairé, deux prises en attente. */
    private Fixture fixture() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        giveConsent(aidant, seniorId, "RAPPELS", true);
        String senior = pairDevice(aidant, seniorId);
        LocalTime soon = LocalTime.now(CASABLANCA).plusMinutes(5).truncatedTo(ChronoUnit.MINUTES);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomMedicament", "Metformine 500",
                                "dateDebut", java.time.LocalDate.now(CASABLANCA).minusDays(1).toString(),
                                "horaires", List.of(Map.of("heure", soon.toString(),
                                        "jours", List.of("LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM")))))))
                .andExpect(status().isCreated());
        List<DoseEvent> pending = doseRepository.findForSenior(UUID.fromString(seniorId), Instant.now().minusSeconds(60),
                        Instant.now().plus(Duration.ofDays(4))).stream()
                .filter(d -> d.getStatut() == DoseStatus.EN_ATTENTE)
                .toList();
        assertThat(pending).hasSizeGreaterThanOrEqualTo(2);
        return new Fixture(aidant, senior, seniorId, pending);
    }

    private void confirm(Fixture f, UUID doseId) throws Exception {
        mvc.perform(bearer(post("/api/v1/doses/{id}/confirm", doseId), f.senior)
                        .header("Idempotency-Key", UUID.randomUUID().toString()))
                .andExpect(status().isOk());
    }

    private static Map<String, Object> nextFor(BlockingQueue<Map<String, Object>> events, UUID doseId)
            throws InterruptedException {
        long deadline = System.nanoTime() + Duration.ofSeconds(3).toNanos();
        while (System.nanoTime() < deadline) {
            Map<String, Object> event = events.poll(200, TimeUnit.MILLISECONDS);
            if (event != null && doseId.toString().equals(event.get("doseId"))) {
                return event;
            }
        }
        throw new AssertionError("Aucun événement pour la prise " + doseId);
    }

    // ---------- Client STOMP de test ----------

    private Client connect(String authorization) throws Exception {
        Client client = new Client();
        client.session = client.connectAsync(authorization).get(5, TimeUnit.SECONDS);
        return client;
    }

    private final class Client extends StompSessionHandlerAdapter {

        final BlockingQueue<StompHeaders> errors = new LinkedBlockingQueue<>();
        StompSession session;

        CompletableFuture<StompSession> connectAsync(String authorization) {
            if (stompClient == null) {
                stompClient = new WebSocketStompClient(new StandardWebSocketClient());
                MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
                converter.setObjectMapper(objectMapper);
                stompClient.setMessageConverter(converter);
            }
            StompHeaders headers = new StompHeaders();
            if (authorization != null) {
                headers.add("Authorization", authorization);
            }
            return stompClient.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), headers, this);
        }

        BlockingQueue<Map<String, Object>> subscribe(String seniorId) throws InterruptedException {
            BlockingQueue<Map<String, Object>> queue = new LinkedBlockingQueue<>();
            session.subscribe("/topic/seniors/" + seniorId + "/events", new StompFrameHandler() {
                @Override
                public Type getPayloadType(StompHeaders headers) {
                    return Map.class;
                }

                @Override
                @SuppressWarnings("unchecked")
                public void handleFrame(StompHeaders headers, Object payload) {
                    queue.add((Map<String, Object>) payload);
                }
            });
            Thread.sleep(300); // laisse le serveur traiter le SUBSCRIBE (le broker simple n'émet pas de reçu)
            return queue;
        }

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return byte[].class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            errors.add(headers); // trames ERROR envoyées au gestionnaire de session
        }

        @Override
        public void handleException(StompSession s, StompCommand command, StompHeaders headers, byte[] payload,
                                    Throwable exception) {
            errors.add(headers);
        }

        @Override
        public void handleTransportError(StompSession s, Throwable exception) {
            errors.add(new StompHeaders());
        }
    }
}
