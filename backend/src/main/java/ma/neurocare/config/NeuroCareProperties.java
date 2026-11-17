package ma.neurocare.config;

import java.time.Duration;
import java.time.ZoneId;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Paramètres applicatifs {@code neurocare.*} (cf. cahier §9.6 et §15.3).
 */
@ConfigurationProperties(prefix = "neurocare")
public record NeuroCareProperties(
        ZoneId timezone,
        Jwt jwt,
        Reminder reminder,
        Audio audio,
        Storage storage) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {
    }

    public record Reminder(Duration tick, Duration relanceAfter, Duration defaultTimeout, int lookaheadHours) {
    }

    public record Audio(String baseUrl, String internalKey, Duration timeout) {
    }

    public record Storage(String endpoint, String accessKey, String secretKey,
                          String voiceSamplesBucket, String audioAssetsBucket, Duration signedUrlTtl) {
    }
}
