package ma.neurocare.support;

import java.lang.reflect.Type;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/** Client STOMP réel (comme l'application aidant) pour les tests de bout en bout du temps réel. */
public final class StompTestClient implements AutoCloseable {

    private final WebSocketStompClient client;
    private final StompSession session;
    private final BlockingQueue<Map<String, Object>> events = new LinkedBlockingQueue<>();

    private StompTestClient(WebSocketStompClient client, StompSession session) {
        this.client = client;
        this.session = session;
    }

    public static StompTestClient connect(int port, String bearerToken, ObjectMapper objectMapper) throws Exception {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(objectMapper);
        client.setMessageConverter(converter);
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + bearerToken);
        StompSession session = client.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(),
                headers, new StompSessionHandlerAdapter() { }).get(5, TimeUnit.SECONDS);
        return new StompTestClient(client, session);
    }

    /** S'abonne aux événements du senior et attend que le serveur ait traité l'abonnement. */
    public StompTestClient subscribeToSenior(String seniorId) throws InterruptedException {
        session.subscribe("/topic/seniors/" + seniorId + "/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }

            @Override
            @SuppressWarnings("unchecked")
            public void handleFrame(StompHeaders headers, Object payload) {
                events.add((Map<String, Object>) payload);
            }
        });
        Thread.sleep(300); // le broker simple n'émet pas de reçu d'abonnement
        return this;
    }

    /** Premier événement satisfaisant la condition dans le délai, sinon {@code null}. */
    public Map<String, Object> await(Predicate<Map<String, Object>> condition, Duration timeout)
            throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (true) {
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) {
                return null;
            }
            Map<String, Object> event = events.poll(remaining, TimeUnit.NANOSECONDS);
            if (event != null && condition.test(event)) {
                return event;
            }
        }
    }

    @Override
    public void close() {
        if (session.isConnected()) {
            session.disconnect();
        }
        client.stop();
    }
}
