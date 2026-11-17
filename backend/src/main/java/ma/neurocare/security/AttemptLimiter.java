package ma.neurocare.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Limiteur d'échecs en fenêtre glissante, en mémoire (une instance pour le MVP ;
 * Bucket4j distribué prévu ensuite, cahier §8.4). Utilisé pour l'appairage : 5 échecs / 15 min.
 */
@Component
public class AttemptLimiter {

    public static final int MAX_FAILURES = 5;
    public static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final Clock clock;

    public AttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    public boolean isBlocked(String key) {
        Deque<Instant> attempts = failures.get(key);
        if (attempts == null) {
            return false;
        }
        synchronized (attempts) {
            prune(attempts);
            return attempts.size() >= MAX_FAILURES;
        }
    }

    public void recordFailure(String key) {
        Deque<Instant> attempts = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (attempts) {
            prune(attempts);
            attempts.addLast(clock.instant());
        }
    }

    public void reset(String key) {
        failures.remove(key);
    }

    private void prune(Deque<Instant> attempts) {
        Instant threshold = clock.instant().minus(WINDOW);
        while (!attempts.isEmpty() && attempts.peekFirst().isBefore(threshold)) {
            attempts.pollFirst();
        }
    }
}
