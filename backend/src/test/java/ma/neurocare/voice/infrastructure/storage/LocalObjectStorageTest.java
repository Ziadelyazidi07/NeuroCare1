package ma.neurocare.voice.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.security.TokenHasher;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage.SignedUrl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** URL signées de 5 min du stockage local : signature HMAC, expiration, confinement au répertoire. */
class LocalObjectStorageTest {

    private static final Instant NOW = Instant.parse("2026-11-17T08:00:00Z");

    @TempDir
    Path dir;

    @Test
    void signedUrlGivesAccessUntilExpiry() {
        LocalObjectStorage storage = storage(NOW);
        storage.put("audio-assets", "med/a.mp3", new byte[]{1, 2, 3}, "audio/mpeg");

        SignedUrl url = storage.signedGetUrl("audio-assets", "med/a.mp3", Duration.ofMinutes(5));
        Map<String, String> q = query(url.url());

        assertThat(url.expireLe()).isEqualTo(NOW.plus(Duration.ofMinutes(5)));
        assertThat(url.url()).startsWith("http://localhost/api/v1/audio/files?");
        assertThat(storage.readSigned(q.get("object"), Long.parseLong(q.get("exp")), q.get("sig")))
                .contains(new byte[]{1, 2, 3});

        LocalObjectStorage sixMinutesLater = storage(NOW.plus(Duration.ofMinutes(6)));
        assertThat(sixMinutesLater.readSigned(q.get("object"), Long.parseLong(q.get("exp")), q.get("sig"))).isEmpty();
    }

    @Test
    void tamperedObjectOrSignatureIsRefused() {
        LocalObjectStorage storage = storage(NOW);
        storage.put("audio-assets", "med/a.mp3", new byte[]{1}, "audio/mpeg");
        storage.put("voice-samples", "senior/s.wav", new byte[]{9}, "audio/wav");
        Map<String, String> q = query(storage.signedGetUrl("audio-assets", "med/a.mp3", Duration.ofMinutes(5)).url());
        long exp = Long.parseLong(q.get("exp"));

        assertThat(storage.readSigned("voice-samples/senior/s.wav", exp, q.get("sig"))).isEmpty();
        assertThat(storage.readSigned(q.get("object"), exp + 3600, q.get("sig"))).isEmpty();
        assertThat(storage.readSigned(q.get("object"), exp, q.get("sig") + "0")).isEmpty();
    }

    @Test
    void pathTraversalIsRejected() {
        LocalObjectStorage storage = storage(NOW);
        assertThatThrownBy(() -> storage.put("audio-assets", "../../etc/passwd", new byte[]{1}, "x"))
                .isInstanceOf(StorageException.class);
        assertThatThrownBy(() -> storage.get("..", "x")).isInstanceOf(StorageException.class);
    }

    @Test
    void deleteIsIdempotent() {
        LocalObjectStorage storage = storage(NOW);
        storage.put("b", "k.mp3", new byte[]{1}, "audio/mpeg");
        storage.delete("b", "k.mp3");
        storage.delete("b", "k.mp3");
        assertThat(storage.get("b", "k.mp3")).isEmpty();
    }

    private LocalObjectStorage storage(Instant now) {
        NeuroCareProperties properties = new NeuroCareProperties(ZoneId.of("UTC"),
                new NeuroCareProperties.Jwt("unit-test-secret-0123456789-abcdefghijklmnop", null, null), null, null,
                new NeuroCareProperties.Storage("local", null, null, null, null, null, dir.toString(),
                        "http://localhost", "voice-samples", "audio-assets", Duration.ofMinutes(5)),
                null);
        return new LocalObjectStorage(properties, new TokenHasher(properties), Clock.fixed(now, ZoneOffset.UTC));
    }

    private static Map<String, String> query(String url) {
        Map<String, String> params = new HashMap<>();
        for (String pair : URI.create(url).getRawQuery().split("&")) {
            String[] kv = pair.split("=", 2);
            params.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
        return params;
    }
}
