package ma.neurocare.voice.domain;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Contrôle d'un échantillon vocal (EF-VO-01, cahier §10.3) : type réel lu dans les octets (jamais le
 * type MIME déclaré), taille ≤ 5 Mo et durée 10–30 s. WAV : durée exacte ; MP3 : estimation à débit constant.
 */
public final class AudioSampleInspector {

    public static final int MAX_BYTES = 5 * 1024 * 1024;
    public static final double MIN_SECONDS = 10.0;
    public static final double MAX_SECONDS = 30.0;

    private static final int[] MP3_BITRATES_V1 = {0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320};
    private static final int[] MP3_BITRATES_V2 = {0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160};

    private AudioSampleInspector() {
    }

    public enum Format {
        WAV("audio/wav", "wav"),
        MP3("audio/mpeg", "mp3");

        private final String mediaType;
        private final String extension;

        Format(String mediaType, String extension) {
            this.mediaType = mediaType;
            this.extension = extension;
        }

        public String mediaType() {
            return mediaType;
        }

        public String extension() {
            return extension;
        }
    }

    public record SampleInfo(Format format, double durationSeconds) {
    }

    /** Échantillon refusé ; le message est destiné à l'aidant. */
    public static class InvalidSampleException extends RuntimeException {
        public InvalidSampleException(String message) {
            super(message);
        }
    }

    public static SampleInfo check(byte[] data) {
        if (data == null || data.length == 0) {
            throw new InvalidSampleException("Fichier vide.");
        }
        if (data.length > MAX_BYTES) {
            throw new InvalidSampleException("Le fichier dépasse 5 Mo.");
        }
        SampleInfo info = inspect(data);
        if (info.durationSeconds() < MIN_SECONDS || info.durationSeconds() > MAX_SECONDS) {
            throw new InvalidSampleException("L'enregistrement doit durer entre 10 et 30 secondes (%.0f s reçues)."
                    .formatted(info.durationSeconds()));
        }
        return info;
    }

    public static SampleInfo inspect(byte[] data) {
        if (data.length >= 12 && ascii(data, 0, "RIFF") && ascii(data, 8, "WAVE")) {
            return new SampleInfo(Format.WAV, wavDuration(data));
        }
        int offset = skipId3(data);
        if (data.length >= offset + 4 && (data[offset] & 0xFF) == 0xFF && (data[offset + 1] & 0xE0) == 0xE0) {
            return new SampleInfo(Format.MP3, mp3Duration(data, offset));
        }
        throw new InvalidSampleException("Format non reconnu : seuls les fichiers WAV et MP3 sont acceptés.");
    }

    private static double wavDuration(byte[] data) {
        ByteBuffer buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
        int pos = 12;
        long byteRate = 0;
        while (pos + 8 <= data.length) {
            long size = Integer.toUnsignedLong(buffer.getInt(pos + 4));
            int body = pos + 8;
            if (ascii(data, pos, "fmt ") && size >= 16 && body + 12 <= data.length) {
                byteRate = Integer.toUnsignedLong(buffer.getInt(body + 8));
            } else if (ascii(data, pos, "data")) {
                if (byteRate == 0) {
                    throw new InvalidSampleException("En-tête WAV incomplet.");
                }
                long available = Math.min(size, data.length - body);
                return (double) available / byteRate;
            }
            long next = body + size + (size % 2);
            if (next > Integer.MAX_VALUE) {
                break;
            }
            pos = (int) next;
        }
        throw new InvalidSampleException("Fichier WAV sans données audio.");
    }

    private static int skipId3(byte[] data) {
        if (data.length >= 10 && ascii(data, 0, "ID3")) {
            return 10 + ((data[6] & 0x7F) << 21 | (data[7] & 0x7F) << 14 | (data[8] & 0x7F) << 7 | (data[9] & 0x7F));
        }
        return 0;
    }

    private static double mp3Duration(byte[] data, int offset) {
        int versionBits = (data[offset + 1] >> 3) & 0x03;
        int bitrateIndex = (data[offset + 2] >> 4) & 0x0F;
        if (bitrateIndex == 0 || bitrateIndex == 15) {
            throw new InvalidSampleException("Débit MP3 non pris en charge.");
        }
        int kbps = (versionBits == 3 ? MP3_BITRATES_V1 : MP3_BITRATES_V2)[bitrateIndex];
        return (data.length - offset) * 8.0 / (kbps * 1000.0);
    }

    private static boolean ascii(byte[] data, int offset, String expected) {
        if (data.length < offset + expected.length()) {
            return false;
        }
        for (int i = 0; i < expected.length(); i++) {
            if (data[offset + i] != (byte) expected.charAt(i)) {
                return false;
            }
        }
        return true;
    }
}
