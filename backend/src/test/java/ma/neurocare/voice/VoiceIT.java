package ma.neurocare.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import ma.neurocare.AbstractIntegrationTest;
import ma.neurocare.voice.domain.AudioSampleInspectorTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Module voice avec le microservice audio arrêté (profil test : aucun service à l'écoute) :
 * contrôles d'upload, consentement VOIX, profil ECHEC et enregistrement joué tel quel (CA-07).
 */
class VoiceIT extends AbstractIntegrationTest {

    private String aidant;
    private String seniorId;

    @BeforeEach
    void setUp() throws Exception {
        aidant = newAidantToken();
        seniorId = createSenior(aidant);
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
    }

    @Test
    void uploadRequiresVoiceConsent() throws Exception {
        upload(AudioSampleInspectorTest.wav(12))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))
                .andExpect(jsonPath("$.detail").value("Le consentement VOIX n'est pas accordé."));
    }

    @Test
    void invalidSamplesAreRejected() throws Exception {
        giveConsent(aidant, seniorId, "VOIX", true);

        upload(AudioSampleInspectorTest.wav(5))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        upload("ceci n'est pas un fichier audio".repeat(100).getBytes())
                .andExpect(status().isBadRequest());
        upload(new byte[5 * 1024 * 1024 + 1])
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
    }

    @Test
    void serviceDownGivesFailedProfileAndPrerecordedFallback() throws Exception {
        giveConsent(aidant, seniorId, "VOIX", true);
        giveConsent(aidant, seniorId, "RAPPELS", true);

        upload(AudioSampleInspectorTest.wav(12))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.statut").value("EN_COURS"));
        awaitUntil("profil ECHEC", () -> "ECHEC".equals(profileStatus()));

        String medicationId = createMedication();
        // Clonage impossible : le téléphone du senior reçoit l'enregistrement de l'aidant.
        mvc.perform(bearer(get("/api/v1/me/medications/{id}/audio", medicationId), pairDevice(aidant, seniorId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.extension").value("wav"));
        // Aucun message généré côté serveur.
        mvc.perform(bearer(post("/api/v1/medications/{id}/audio/preview", medicationId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("PREENREGISTRE"))
                .andExpect(jsonPath("$.url").doesNotExist())
                .andExpect(jsonPath("$.texte").value(org.hamcrest.Matchers.startsWith("Baba")));
    }

    @Test
    void phoneRecordingInM4aIsAccepted() throws Exception {
        giveConsent(aidant, seniorId, "VOIX", true);
        mvc.perform(bearer(multipart("/api/v1/seniors/{id}/voice-profile", seniorId)
                        .file(new MockMultipartFile("file", "enregistrement.m4a", "audio/mp4",
                                AudioSampleInspectorTest.m4a(12_000, 1000, 0))), aidant))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.statut").value("EN_COURS"));
    }

    @Test
    void deleteRemovesVoiceProfileAndSeniorCanDeleteToo() throws Exception {
        giveConsent(aidant, seniorId, "VOIX", true);
        upload(AudioSampleInspectorTest.wav(12)).andExpect(status().isAccepted());

        String senior = pairDevice(aidant, seniorId);
        mvc.perform(bearer(delete("/api/v1/seniors/{id}/voice-profile", seniorId), senior))
                .andExpect(status().isNoContent());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/voice-profile", seniorId), aidant))
                .andExpect(status().isNotFound());
    }

    @Test
    void unlinkedAidantCannotUploadOrReadVoice() throws Exception {
        giveConsent(aidant, seniorId, "VOIX", true);
        String stranger = newAidantToken();

        mvc.perform(bearer(multipart("/api/v1/seniors/{id}/voice-profile", seniorId)
                        .file(new MockMultipartFile("file", "s.wav", "audio/wav", AudioSampleInspectorTest.wav(12))),
                        stranger))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/voice-profile", seniorId), stranger))
                .andExpect(status().isNotFound());
    }

    @Test
    void phoneOnlyReceivesTheCaregiverRecording() throws Exception {
        byte[] sample = AudioSampleInspectorTest.wav(12);
        giveConsent(aidant, seniorId, "VOIX", true);
        giveConsent(aidant, seniorId, "RAPPELS", true);
        String medicationId = createMedication();
        String senior = pairDevice(aidant, seniorId);

        // Pas encore de voix : aucun fichier, le téléphone joue sa tonalité.
        phoneAudio(medicationId, senior).andExpect(status().isNotFound());

        upload(sample).andExpect(status().isAccepted());
        MvcResult audio = phoneAudio(medicationId, senior).andExpect(status().isOk())
                .andExpect(jsonPath("$.extension").value("wav"))
                .andReturn();
        byte[] downloaded = mvc.perform(get(URI.create(read(audio, "$.url")))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(downloaded).isEqualTo(sample);
        awaitUntil("profil ECHEC", () -> "ECHEC".equals(profileStatus()));

        // EF-CO-05 : après révocation, la voix n'est plus servie.
        giveConsent(aidant, seniorId, "VOIX", false);
        phoneAudio(medicationId, senior).andExpect(status().isNotFound());
    }

    private ResultActions phoneAudio(String medicationId, String senior) throws Exception {
        return mvc.perform(bearer(get("/api/v1/me/medications/{id}/audio", medicationId), senior));
    }

    private ResultActions upload(byte[] content) throws Exception {
        return mvc.perform(bearer(multipart("/api/v1/seniors/{id}/voice-profile", seniorId)
                .file(new MockMultipartFile("file", "echantillon.wav", "audio/wav", content)), aidant));
    }

    private String profileStatus() throws Exception {
        MvcResult result = mvc.perform(bearer(get("/api/v1/seniors/{id}/voice-profile", seniorId), aidant)).andReturn();
        return result.getResponse().getStatus() == 200 ? read(result, "$.statut") : null;
    }

    private String createMedication() throws Exception {
        MvcResult result = mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomMedicament", "Metformine 500",
                                "dateDebut", LocalDate.now(ZoneId.of("Africa/Casablanca")).toString(),
                                "horaires", List.of(Map.of("heure", "08:00", "jours", List.of("LUN", "JEU")))))))
                .andExpect(status().isCreated())
                .andReturn();
        return read(result, "$.id");
    }
}
