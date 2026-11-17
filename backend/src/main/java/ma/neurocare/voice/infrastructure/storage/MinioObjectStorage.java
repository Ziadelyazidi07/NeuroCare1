package ma.neurocare.voice.infrastructure.storage;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.errors.ErrorResponseException;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.config.NeuroCareProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * MinIO / S3 : buckets privés {@code voice-samples} et {@code audio-assets}. Les URL présignées sont
 * calculées avec l'adresse publique (vue par les téléphones), sans appel réseau grâce à la région fixée.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "neurocare.storage.provider", havingValue = "minio", matchIfMissing = true)
public class MinioObjectStorage implements ObjectStorage {

    private final MinioClient client;
    private final MinioClient signer;
    private final NeuroCareProperties.Storage config;
    private final Clock clock;
    private volatile boolean bucketsReady;

    public MinioObjectStorage(NeuroCareProperties properties, Clock clock) {
        this.config = properties.storage();
        this.clock = clock;
        this.client = MinioClient.builder()
                .endpoint(config.endpoint())
                .region(config.region())
                .credentials(config.accessKey(), config.secretKey())
                .build();
        this.signer = MinioClient.builder()
                .endpoint(config.publicEndpoint())
                .region(config.region())
                .credentials(config.accessKey(), config.secretKey())
                .build();
    }

    /**
     * Crée les buckets au démarrage. Si MinIO n'est pas encore prêt, le backend démarre quand même et
     * la création est retentée au premier dépôt de fichier.
     */
    @PostConstruct
    void ensureBuckets() {
        boolean ready = true;
        for (String bucket : List.of(config.voiceSamplesBucket(), config.audioAssetsBucket())) {
            try {
                if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
                    client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                }
            } catch (Exception e) {
                ready = false;
                log.warn("Bucket {} non vérifié (MinIO indisponible ?) : {}", bucket, e.getClass().getSimpleName());
            }
        }
        bucketsReady = ready;
    }

    @Override
    public void put(String bucket, String key, byte[] content, String contentType) {
        if (!bucketsReady) {
            ensureBuckets();
        }
        try {
            client.putObject(PutObjectArgs.builder()
                    .bucket(bucket).object(key)
                    .stream(new ByteArrayInputStream(content), content.length, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new StorageException("Écriture impossible dans " + bucket, e);
        }
    }

    @Override
    public Optional<byte[]> get(String bucket, String key) {
        try (InputStream in = client.getObject(GetObjectArgs.builder().bucket(bucket).object(key).build())) {
            return Optional.of(in.readAllBytes());
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code())) {
                return Optional.empty();
            }
            throw new StorageException("Lecture impossible dans " + bucket, e);
        } catch (Exception e) {
            throw new StorageException("Lecture impossible dans " + bucket, e);
        }
    }

    @Override
    public void delete(String bucket, String key) {
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            throw new StorageException("Suppression impossible dans " + bucket, e);
        }
    }

    @Override
    public SignedUrl signedGetUrl(String bucket, String key, Duration ttl) {
        try {
            String url = signer.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET).bucket(bucket).object(key)
                    .expiry((int) ttl.toSeconds())
                    .build());
            return new SignedUrl(url, clock.instant().plus(ttl));
        } catch (Exception e) {
            throw new StorageException("Signature d'URL impossible", e);
        }
    }
}
