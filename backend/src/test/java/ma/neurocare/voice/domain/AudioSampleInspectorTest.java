package ma.neurocare.voice.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

import ma.neurocare.voice.domain.AudioSampleInspector.Format;
import ma.neurocare.voice.domain.AudioSampleInspector.InvalidSampleException;
import org.junit.jupiter.api.Test;

/** EF-VO-01 : type réel (octets), taille ≤ 5 Mo, durée 10–30 s. */
public class AudioSampleInspectorTest {

    @Test
    void wavDurationIsExact() {
        AudioSampleInspector.SampleInfo info = AudioSampleInspector.check(wav(12));

        assertThat(info.format()).isEqualTo(Format.WAV);
        assertThat(info.durationSeconds()).isCloseTo(12.0, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    void mp3IsDetectedByFrameHeaderEvenBehindId3Tag() {
        byte[] id3 = new byte[20];
        System.arraycopy("ID3".getBytes(StandardCharsets.US_ASCII), 0, id3, 0, 3);
        id3[9] = 10; // taille du tag : 10 octets après l'en-tête
        byte[] frames = mp3(15);
        byte[] tagged = new byte[id3.length + frames.length];
        System.arraycopy(id3, 0, tagged, 0, id3.length);
        System.arraycopy(frames, 0, tagged, id3.length, frames.length);

        AudioSampleInspector.SampleInfo info = AudioSampleInspector.check(tagged);
        assertThat(info.format()).isEqualTo(Format.MP3);
        assertThat(info.durationSeconds()).isBetween(14.9, 15.1);
    }

    @Test
    void durationOutsideTenToThirtySecondsIsRejected() {
        assertThatThrownBy(() -> AudioSampleInspector.check(wav(5))).isInstanceOf(InvalidSampleException.class)
                .hasMessageContaining("entre 10 et 30 secondes");
        assertThatThrownBy(() -> AudioSampleInspector.check(wav(31))).isInstanceOf(InvalidSampleException.class);
    }

    @Test
    void declaredTypeIsIgnoredOnlyContentCounts() {
        byte[] fakeWav = "RIFF....not really audio, just text pretending".getBytes(StandardCharsets.US_ASCII);
        assertThatThrownBy(() -> AudioSampleInspector.check(fakeWav)).isInstanceOf(InvalidSampleException.class);

        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        assertThatThrownBy(() -> AudioSampleInspector.check(png)).isInstanceOf(InvalidSampleException.class)
                .hasMessageContaining("WAV et MP3");
    }

    @Test
    void oversizedAndEmptyFilesAreRejected() {
        assertThatThrownBy(() -> AudioSampleInspector.check(new byte[AudioSampleInspector.MAX_BYTES + 1]))
                .isInstanceOf(InvalidSampleException.class).hasMessageContaining("5 Mo");
        assertThatThrownBy(() -> AudioSampleInspector.check(new byte[0])).isInstanceOf(InvalidSampleException.class);
    }

    /** WAV PCM 16 bits mono 8 kHz de la durée demandée. */
    public static byte[] wav(double seconds) {
        int rate = 8000;
        int dataSize = (int) (seconds * rate * 2);
        ByteBuffer b = ByteBuffer.allocate(44 + dataSize).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + dataSize).put("WAVE".getBytes(StandardCharsets.US_ASCII));
        b.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 1)
                .putInt(rate).putInt(rate * 2).putShort((short) 2).putShort((short) 16);
        b.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(dataSize);
        return b.array();
    }

    /** MP3 factice : en-tête MPEG-1 Layer III 64 kbit/s suivi de données. */
    static byte[] mp3(double seconds) {
        byte[] data = new byte[(int) (seconds * 64_000 / 8)];
        data[0] = (byte) 0xFF;
        data[1] = (byte) 0xFB;
        data[2] = 0x50;
        data[3] = (byte) 0xC4;
        return data;
    }
}
