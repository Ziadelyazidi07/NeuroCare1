package ma.neurocare.voice.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.common.domain.Language;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.medication.application.MedicationAudioInfo;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.user.application.SeniorAudioProfile;
import ma.neurocare.user.application.SeniorService;
import ma.neurocare.voice.application.AudioGenerationService.AudioResult;
import ma.neurocare.voice.domain.AudioAsset;
import ma.neurocare.voice.domain.AudioSource;
import ma.neurocare.voice.domain.VoiceProfile;
import ma.neurocare.voice.domain.VoiceProfileStatus;
import ma.neurocare.voice.infrastructure.AudioAssetRepository;
import ma.neurocare.voice.infrastructure.AudioServiceClient;
import ma.neurocare.voice.infrastructure.AudioServiceClient.Synthesized;
import ma.neurocare.voice.infrastructure.AudioServiceRejectedException;
import ma.neurocare.voice.infrastructure.AudioServiceUnavailableException;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** Chaîne de repli du cahier §10.4 : CLONE → TTS_STANDARD → PREENREGISTRE (EF-VO-04, CA-07). */
class AudioFallbackChainTest {

    private static final byte[] MP3 = {(byte) 0xFF, (byte) 0xFB, 0x50, 0x00};

    private final AudioServiceClient client = mock(AudioServiceClient.class);
    private final ObjectStorage storage = mock(ObjectStorage.class);
    private final AudioAssetRepository assets = mock(AudioAssetRepository.class);
    private final VoiceProfileFinder voices = mock(VoiceProfileFinder.class);
    private final MedicationService medications = mock(MedicationService.class);
    private final SeniorService seniors = mock(SeniorService.class);
    private final CaregiverLinkService links = mock(CaregiverLinkService.class);

    private final UUID medicationId = UUID.randomUUID();
    private final UUID seniorId = UUID.randomUUID();
    private final UUID aidantId = UUID.randomUUID();
    private final UUID linkId = UUID.randomUUID();

    private AudioGenerationService service;
    private VoiceProfile readyVoice;

    @BeforeEach
    void setUp() {
        NeuroCareProperties properties = new NeuroCareProperties(ZoneId.of("Africa/Casablanca"), null, null, null,
                new NeuroCareProperties.Storage("local", null, null, null, null, null, "x", "http://localhost",
                        "voice-samples", "audio-assets", Duration.ofMinutes(5)),
                null);
        service = new AudioGenerationService(client, storage, assets, voices, medications, seniors, links, properties);

        when(medications.audioInfo(medicationId))
                .thenReturn(new MedicationAudioInfo(medicationId, seniorId, "Metformine 500", aidantId, true));
        when(seniors.audioProfile(seniorId)).thenReturn(new SeniorAudioProfile(seniorId, "Ahmed B.", Language.FR));
        CaregiverLinkView link = new CaregiverLinkView(linkId, seniorId, aidantId, "fille", "Baba", true, null);
        when(links.findLink(seniorId, aidantId)).thenReturn(Optional.of(link));
        when(links.findLinkById(linkId)).thenReturn(Optional.of(link));
        when(assets.findCached(any(), anyString(), any(), any())).thenReturn(Optional.empty());
        when(assets.save(any(AudioAsset.class))).thenAnswer(inv -> inv.getArgument(0));
        when(assets.findByMedicationIdOrderByDateCreationDesc(medicationId)).thenReturn(List.of());

        readyVoice = new VoiceProfile(linkId, "senior/sample.wav");
        readyVoice.setStatut(VoiceProfileStatus.PRET);
        readyVoice.setProviderVoiceId("voice-123");
    }

    @Test
    void level1_clonedVoiceWhenProfileReadyAndServiceUp() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.of(readyVoice));
        when(client.synthesize(eq("voice-123"), anyString(), eq(Language.FR)))
                .thenReturn(new Synthesized(MP3, "audio/mpeg"));

        AudioResult result = service.audioForMedication(medicationId);

        assertThat(result.source()).isEqualTo(AudioSource.CLONE);
        assertThat(result.asset().getVoiceProfileId()).isEqualTo(readyVoice.getId());
        assertThat(result.texte())
                .isEqualTo("Baba, c'est l'heure de ton médicament Metformine 500. Appuie sur le gros bouton quand c'est fait.");
        verify(storage).put(eq("audio-assets"), anyString(), eq(MP3), eq("audio/mpeg"));
        verify(client, never()).synthesize(isNull(), anyString(), any());
    }

    @Test
    void level2_standardTtsWhenCloningFails() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.of(readyVoice));
        when(client.synthesize(eq("voice-123"), anyString(), any()))
                .thenThrow(new AudioServiceUnavailableException("panne", null));
        when(client.synthesize(isNull(), anyString(), any())).thenReturn(new Synthesized(MP3, "audio/mpeg"));

        AudioResult result = service.audioForMedication(medicationId);

        assertThat(result.source()).isEqualTo(AudioSource.TTS_STANDARD);
        ArgumentCaptor<AudioAsset> saved = ArgumentCaptor.forClass(AudioAsset.class);
        verify(assets).save(saved.capture());
        assertThat(saved.getValue().getSource()).isEqualTo(AudioSource.TTS_STANDARD);
        assertThat(saved.getValue().getVoiceProfileId()).isNull();
    }

    @Test
    void level2_directlyWithoutUsableVoice() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.empty()); // pas de consentement VOIX ou profil ECHEC
        when(client.synthesize(isNull(), anyString(), any())).thenReturn(new Synthesized(MP3, "audio/mpeg"));

        assertThat(service.audioForMedication(medicationId).source()).isEqualTo(AudioSource.TTS_STANDARD);
        verify(client, times(1)).synthesize(any(), anyString(), any());
    }

    @Test
    void level3_prerecordedWhenAudioServiceIsDown() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.of(readyVoice));
        when(client.synthesize(any(), anyString(), any()))
                .thenThrow(new AudioServiceUnavailableException("disjoncteur ouvert", null));

        AudioResult result = service.audioForMedication(medicationId);

        assertThat(result.source()).isEqualTo(AudioSource.PREENREGISTRE);
        assertThat(result.file()).isEmpty();
        verify(storage, never()).put(any(), any(), any(), any());
        verify(assets, never()).save(any());
    }

    @Test
    void level3_forDarijaRejectedByTts() {
        when(seniors.audioProfile(seniorId)).thenReturn(new SeniorAudioProfile(seniorId, "Ahmed", Language.DARIJA));
        when(voices.usableVoice(seniorId)).thenReturn(Optional.empty());
        when(client.synthesize(isNull(), anyString(), eq(Language.DARIJA)))
                .thenThrow(new AudioServiceRejectedException(422, "UNSUPPORTED_LANGUAGE"));

        AudioResult result = service.audioForMedication(medicationId);

        assertThat(result.source()).isEqualTo(AudioSource.PREENREGISTRE);
        assertThat(result.texte()).startsWith("Baba، ");
    }

    @Test
    void storageFailureAlsoFallsBack() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.empty());
        when(client.synthesize(isNull(), anyString(), any())).thenReturn(new Synthesized(MP3, "audio/mpeg"));
        org.mockito.Mockito.doThrow(new IllegalStateException("MinIO HS")).when(storage)
                .put(any(), any(), any(), any());

        assertThat(service.audioForMedication(medicationId).source()).isEqualTo(AudioSource.PREENREGISTRE);
    }

    @Test
    void cachedAudioIsReusedWithoutCallingTheService() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.empty());
        AudioAsset cached = new AudioAsset(medicationId, null, Language.FR, "texte", AudioSource.TTS_STANDARD, "k.mp3");
        when(assets.findCached(eq(medicationId), anyString(), eq(Language.FR), isNull()))
                .thenReturn(Optional.of(cached));

        AudioResult result = service.audioForMedication(medicationId);

        assertThat(result.asset()).isSameAs(cached);
        verify(client, never()).synthesize(any(), any(), any());
    }

    @Test
    void cachedTtsIsNotUsedWhenAReadyVoiceCanBeCloned() {
        when(voices.usableVoice(seniorId)).thenReturn(Optional.of(readyVoice));
        AudioAsset tts = new AudioAsset(medicationId, null, Language.FR, "texte", AudioSource.TTS_STANDARD, "k.mp3");
        when(assets.findCached(eq(medicationId), anyString(), eq(Language.FR), isNull())).thenReturn(Optional.of(tts));
        when(client.synthesize(eq("voice-123"), anyString(), any())).thenReturn(new Synthesized(MP3, "audio/mpeg"));

        assertThat(service.audioForMedication(medicationId).source()).isEqualTo(AudioSource.CLONE);
    }

    @Test
    void surnameFallsBackToSeniorNameWithoutNickname() {
        when(links.findLink(seniorId, aidantId)).thenReturn(Optional.empty());
        when(voices.usableVoice(seniorId)).thenReturn(Optional.empty());
        when(client.synthesize(any(), anyString(), any())).thenThrow(new AudioServiceUnavailableException("x", null));

        assertThat(service.audioForMedication(medicationId).texte()).startsWith("Ahmed B., c'est l'heure");
    }
}
