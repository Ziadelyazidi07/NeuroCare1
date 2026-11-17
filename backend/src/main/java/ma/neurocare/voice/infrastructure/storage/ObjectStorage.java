package ma.neurocare.voice.infrastructure.storage;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Stockage des fichiers audio hors base (cahier §4.1) : buckets privés, accès par URL signée de courte durée.
 */
public interface ObjectStorage {

    void put(String bucket, String key, byte[] content, String contentType);

    Optional<byte[]> get(String bucket, String key);

    /** Idempotent : supprimer un objet absent n'est pas une erreur. */
    void delete(String bucket, String key);

    SignedUrl signedGetUrl(String bucket, String key, Duration ttl);

    record SignedUrl(String url, Instant expireLe) {
    }
}
