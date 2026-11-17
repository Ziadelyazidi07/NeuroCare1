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
        Storage storage,
        Push push) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl) {
    }

    /**
     * @param tick             période des jobs d'envoi et de clôture
     * @param relanceAfter     délai de la relance unique après l'heure prévue (EF-RE-05)
     * @param defaultTimeout   délai SANS_REPONSE par défaut d'un nouveau profil (le schéma fixe 30 min)
     * @param timeoutOverride  si renseigné, remplace le délai de chaque senior (profil demo : PT1M)
     * @param lookaheadHours   horizon des prises générées à l'avance (mode hors ligne, cahier §9.5)
     * @param schedulingEnabled active les jobs planifiés (désactivé en test)
     */
    public record Reminder(Duration tick, Duration relanceAfter, Duration defaultTimeout, Duration timeoutOverride,
                           int lookaheadHours, boolean schedulingEnabled) {

        /** Nombre de jours générés à l'avance, jour courant inclus. */
        public int lookaheadDays() {
            return Math.max(1, lookaheadHours / 24 + 1);
        }

        public Duration effectiveTimeout(int seniorDelayMinutes) {
            return timeoutOverride != null ? timeoutOverride : Duration.ofMinutes(seniorDelayMinutes);
        }
    }

    public record Audio(String baseUrl, String internalKey, Duration timeout) {
    }

    /**
     * @param provider        {@code minio} (S3) ou {@code local} (disque, raccourci hackathon §16.2 et tests)
     * @param endpoint        URL interne de MinIO (réseau Docker)
     * @param publicEndpoint  URL de MinIO vue par les téléphones (hôte des URL signées)
     * @param region          région S3 (évite un appel réseau lors de la signature)
     * @param localDir        répertoire du stockage local
     * @param publicBaseUrl   URL publique du backend (URL signées du stockage local)
     */
    public record Storage(String provider, String endpoint, String publicEndpoint, String region,
                          String accessKey, String secretKey, String localDir, String publicBaseUrl,
                          String voiceSamplesBucket, String audioAssetsBucket, Duration signedUrlTtl) {
    }

    /** @param provider {@code log} (factice, défaut) ou {@code fcm} (Firebase Cloud Messaging) */
    public record Push(String provider) {
    }
}
