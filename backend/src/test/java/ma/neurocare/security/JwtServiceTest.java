package ma.neurocare.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;

import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.user.domain.UserRole;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-0123456789-abcdefghijklmnop";
    private static final Instant NOW = Instant.parse("2026-11-17T08:00:00Z");

    @Test
    void issuedTokenRoundTrips() {
        JwtService jwt = service(SECRET, Clock.fixed(NOW, ZoneOffset.UTC));
        UUID userId = UUID.randomUUID();

        AuthenticatedUser parsed = jwt.parse(jwt.issueAccessToken(userId, UserRole.AIDANT)).orElseThrow();

        assertThat(parsed.userId()).isEqualTo(userId);
        assertThat(parsed.role()).isEqualTo(UserRole.AIDANT);
        assertThat(parsed.deviceId()).isNull();
        assertThat(jwt.accessTtlSeconds()).isEqualTo(900);
    }

    @Test
    void expiredTokenIsRejected() {
        String token = service(SECRET, Clock.fixed(NOW, ZoneOffset.UTC))
                .issueAccessToken(UUID.randomUUID(), UserRole.AIDANT);

        JwtService later = service(SECRET, Clock.fixed(NOW.plus(Duration.ofMinutes(16)), ZoneOffset.UTC));
        assertThat(later.parse(token)).isEmpty();
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() {
        String token = service(SECRET, Clock.fixed(NOW, ZoneOffset.UTC))
                .issueAccessToken(UUID.randomUUID(), UserRole.AIDANT);

        JwtService other = service(SECRET + "-other", Clock.fixed(NOW, ZoneOffset.UTC));
        assertThat(other.parse(token)).isEmpty();
        assertThat(other.parse("pas-un-jwt")).isEmpty();
    }

    @Test
    void shortSecretFailsFast() {
        assertThatThrownBy(() -> service("trop-court", Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> service(null, Clock.systemUTC()))
                .isInstanceOf(IllegalStateException.class);
    }

    private static JwtService service(String secret, Clock clock) {
        NeuroCareProperties props = new NeuroCareProperties(ZoneId.of("Africa/Casablanca"),
                new NeuroCareProperties.Jwt(secret, Duration.ofMinutes(15), Duration.ofDays(30)),
                null, null, null);
        return new JwtService(props, clock);
    }
}
