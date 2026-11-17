package ma.neurocare.voice;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * contrôles d'upload, consentement VOIX, profil ECHEC et repli niveau 3 (CA-07).
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
        // Niveau 3 : aucun fichier serveur, l'application joue son audio générique embarqué.
        mvc.perform(bearer(post("/api/v1/medications/{id}/audio/preview", medicationId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("PREENREGISTRE"))
                .andExpect(jsonPath("$.url").doesNotExist())
                .andExpect(jsonPath("$.texte").value(org.hamcrest.Matchers.startsWith("Baba")));
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
