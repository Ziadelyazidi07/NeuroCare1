package ma.neurocare.voice.infrastructure.storage;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.regex.Pattern;

import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.security.TokenHasher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Stockage sur disque local (raccourci hackathon, cahier §16.2, et tests). Les URL signées pointent vers
 * {@code GET /api/v1/audio/files}, servi par le backend après vérification d'une signature HMAC et
 * d'une date d'expiration.
 */
@Component
@ConditionalOnProperty(name = "neurocare.storage.provider", havingValue = "local")
public class LocalObjectStorage implements ObjectStorage {

    public static final String FILES_PATH = "/api/v1/audio/files";
    private static final Pattern SAFE_SEGMENT = Pattern.compile("^[A-Za-z0-9._-]+$");

    private final Path root;
    private final String publicBaseUrl;
    private final TokenHasher hasher;
    private final Clock clock;

    public LocalObjectStorage(NeuroCareProperties properties, TokenHasher hasher, Clock clock) {
        this.root = Path.of(properties.storage().localDir()).toAbsolutePath().normalize();
        this.publicBaseUrl = properties.storage().publicBaseUrl();
        this.hasher = hasher;
        this.clock = clock;
    }

    @Override
    public void put(String bucket, String key, byte[] content, String contentType) {
        Path target = resolve(bucket, key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException e) {
            throw new StorageException("Écriture impossible", e);
        }
    }

    @Override
    public Optional<byte[]> get(String bucket, String key) {
        try {
            return Optional.of(Files.readAllBytes(resolve(bucket, key)));
        } catch (NoSuchFileException e) {
            return Optional.empty();
        } catch (IOException e) {
            throw new StorageException("Lecture impossible", e);
        }
    }

    @Override
    public void delete(String bucket, String key) {
        try {
            Files.deleteIfExists(resolve(bucket, key));
        } catch (IOException e) {
            throw new StorageException("Suppression impossible", e);
        }
    }

    @Override
    public SignedUrl signedGetUrl(String bucket, String key, Duration ttl) {
        Instant expires = clock.instant().plus(ttl);
        String object = bucket + "/" + key;
        String url = publicBaseUrl + FILES_PATH
                + "?object=" + URLEncoder.encode(object, StandardCharsets.UTF_8)
                + "&exp=" + expires.getEpochSecond()
                + "&sig=" + signature(object, expires.getEpochSecond());
        return new SignedUrl(url, expires);
    }

    /** Vérifie une URL signée ; renvoie le contenu si la signature est valide et non expirée. */
    public Optional<byte[]> readSigned(String object, long exp, String sig) {
        if (object == null || sig == null || exp < clock.instant().getEpochSecond()) {
            return Optional.empty();
        }
        byte[] expected = signature(object, exp).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, sig.getBytes(StandardCharsets.UTF_8))) {
            return Optional.empty();
        }
        int slash = object.indexOf('/');
        if (slash <= 0) {
            return Optional.empty();
        }
        return get(object.substring(0, slash), object.substring(slash + 1));
    }

    private String signature(String object, long exp) {
        return hasher.hmac("storage:" + object + ":" + exp);
    }

    /** Empêche toute sortie du répertoire racine (clés composées de segments sûrs uniquement). */
    private Path resolve(String bucket, String key) {
        String[] segments = (bucket + "/" + key).split("/");
        Path path = root;
        for (String segment : segments) {
            if (!SAFE_SEGMENT.matcher(segment).matches() || segment.equals("..") || segment.equals(".")) {
                throw new StorageException("Clé d'objet invalide", null);
            }
            path = path.resolve(segment);
        }
        return path;
    }
}
