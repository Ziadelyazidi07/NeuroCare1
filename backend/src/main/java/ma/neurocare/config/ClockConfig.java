package ma.neurocare.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Horloge injectable : les services utilisent {@link Clock} plutôt que {@code Instant.now()}
 * pour rendre le moteur de rappel testable (cahier §14.1).
 */
@Configuration
public class ClockConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
