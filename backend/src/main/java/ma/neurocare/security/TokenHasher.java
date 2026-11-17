package ma.neurocare.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import ma.neurocare.config.NeuroCareProperties;
import org.springframework.stereotype.Component;

/**
 * Génération et empreinte des secrets opaques (refresh tokens, tokens d'appareil, codes d'appairage).
 * Seules les empreintes sont stockées en base.
 */
@Component
public class TokenHasher {

    /** Préfixe des tokens d'appareil senior, pour les distinguer d'un JWT. */
    public static final String DEVICE_TOKEN_PREFIX = "ncd_";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final byte[] pepper;

    public TokenHasher(NeuroCareProperties properties) {
        this.pepper = properties.jwt().secret().getBytes(StandardCharsets.UTF_8);
    }

    /** Valeur aléatoire de 256 bits encodée en base64url. */
    public String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String newDeviceToken() {
        return DEVICE_TOKEN_PREFIX + randomToken();
    }

    /** Code numérique à 6 chiffres. */
    public String randomSixDigitCode() {
        return "%06d".formatted(RANDOM.nextInt(1_000_000));
    }

    /** SHA-256 hexadécimal (tokens à haute entropie). */
    public String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * HMAC-SHA256 avec un secret serveur : un code à 6 chiffres a trop peu d'entropie
     * pour qu'un simple SHA-256 protège la base en cas de fuite.
     */
    public String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
