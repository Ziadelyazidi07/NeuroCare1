package ma.neurocare.security;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.user.domain.UserRole;
import org.springframework.stereotype.Service;

/**
 * Access tokens JWT HS256, 15 min ; claims {@code sub}, {@code role}, {@code iat}, {@code exp}, {@code jti}
 * (cahier §8.1).
 */
@Service
public class JwtService {

    private static final String ROLE_CLAIM = "role";
    private static final int MIN_SECRET_BYTES = 32;

    private final SecretKey key;
    private final Duration accessTtl;
    private final Clock clock;

    public JwtService(NeuroCareProperties properties, Clock clock) {
        String secret = properties.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "NEUROCARE_JWT_SECRET doit contenir au moins 256 bits (32 octets).");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTtl = properties.jwt().accessTtl();
        this.clock = clock;
    }

    public String issueAccessToken(UUID userId, UserRole role) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(userId.toString())
                .claim(ROLE_CLAIM, role.name())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }

    /** Token valide → principal ; signature, format ou expiration invalides → vide. */
    public Optional<AuthenticatedUser> parse(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(AuthenticatedUser.ofJwt(
                    UUID.fromString(claims.getSubject()),
                    UserRole.valueOf(claims.get(ROLE_CLAIM, String.class))));
        } catch (JwtException | IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }
}
