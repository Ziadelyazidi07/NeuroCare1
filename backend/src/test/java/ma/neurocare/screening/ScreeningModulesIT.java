package ma.neurocare.screening;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.Map;

import ma.neurocare.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Modules 2 (SpO2) et 3 (Mini-GDS / GDS-15) : accès, alertes, cotation par le serveur. */
class ScreeningModulesIT extends AbstractIntegrationTest {

    private String aidant;
    private String seniorId;
    private String senior;

    @BeforeEach
    void setUp() throws Exception {
        aidant = newAidantToken();
        seniorId = createSenior(aidant);
        senior = pairDevice(aidant, seniorId);
    }

    // ---------- SpO2 ----------

    @Test
    void spo2RequiresTheRespiratoryProfileThenClassifiesEachMeasurement() throws Exception {
        mvc.perform(bearer(get("/api/v1/seniors/{id}/spo2/profile", seniorId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maladieRespiratoireChronique").doesNotExist());
        measure(senior, 96).andExpect(status().isBadRequest());

        profile(senior, false);
        measure(senior, 96).andExpect(status().isCreated()).andExpect(jsonPath("$.niveau").value("VERT"));
        measure(senior, 92).andExpect(jsonPath("$.niveau").value("ORANGE"));
        measure(senior, 88).andExpect(jsonPath("$.niveau").value("ROUGE"));

        // Profil BPCO : 88 % est dans la cible, 96 % en dehors, 84 % en urgence.
        profile(senior, true);
        measure(senior, 88).andExpect(jsonPath("$.niveau").value("VERT"))
                .andExpect(jsonPath("$.maladieRespiratoireChronique").value(true));
        measure(senior, 96).andExpect(jsonPath("$.niveau").value("ORANGE"));
        measure(senior, 84).andExpect(jsonPath("$.niveau").value("ROUGE"));

        mvc.perform(bearer(get("/api/v1/seniors/{id}/spo2/measurements", seniorId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mesures.length()").value(6))
                .andExpect(jsonPath("$.mesures[0].spo2").value(84))
                .andExpect(jsonPath("$.avertissement").value(org.hamcrest.Matchers.containsString("pas un diagnostic")));
    }

    @Test
    void spo2RejectsImpossibleValues() throws Exception {
        profile(senior, false);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/spo2/measurements", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("spo2", 101, "pouls", 70))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void caregiverNeedsFamilySharingAndOtherSeniorsStayHidden() throws Exception {
        mvc.perform(bearer(get("/api/v1/seniors/{id}/spo2/measurements", seniorId), aidant))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));
        mvc.perform(bearer(get("/api/v1/seniors/{id}/gds/assessments", seniorId), newAidantToken()))
                .andExpect(status().isNotFound());
        String otherSenior = createSenior(aidant);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/spo2/profile", otherSenior), senior))
                .andExpect(status().isNotFound());

        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        profile(aidant, false);
        measure(aidant, 97).andExpect(status().isCreated());
    }

    // ---------- Mini-GDS / GDS-15 ----------

    @Test
    void miniGdsAtZeroStopsAndIsRecorded() throws Exception {
        mvc.perform(bearer(post("/api/v1/seniors/{id}/gds/assessments", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("reponses", miniGds(false)))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.scoreMiniGds").value(0))
                .andExpect(jsonPath("$.scoreGds15").doesNotExist())
                .andExpect(jsonPath("$.niveau").value("INDICE_NORMAL"));
    }

    @Test
    void positiveMiniGdsIsScoredOnTheFullGds15ByTheServer() throws Exception {
        Map<String, Boolean> answers = miniGds(true); // 4 points Mini-GDS, dont 3 items GDS-15
        for (String code : new String[] {"GDS_02", "GDS_04", "GDS_06", "GDS_08", "GDS_09", "GDS_10", "GDS_12", "GDS_15"}) {
            answers.put(code, code.equals("GDS_02") || code.equals("GDS_04")); // 2 points
        }
        for (String code : new String[] {"GDS_01", "GDS_05", "GDS_11", "GDS_13"}) {
            answers.put(code, true); // items inversés : Oui = 0 point
        }
        mvc.perform(bearer(post("/api/v1/seniors/{id}/gds/assessments", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("reponses", answers))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.scoreMiniGds").value(4))
                .andExpect(jsonPath("$.scoreGds15").value(5))
                .andExpect(jsonPath("$.niveau").value("LEGERE_A_MODEREE"));

        answers.remove("GDS_15");
        mvc.perform(bearer(post("/api/v1/seniors/{id}/gds/assessments", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("reponses", answers))))
                .andExpect(status().isBadRequest());

        mvc.perform(bearer(get("/api/v1/seniors/{id}/gds/assessments", seniorId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passations.length()").value(1))
                .andExpect(jsonPath("$.passations[0].reponses.GDS_02").value(true));
    }

    /** Mini-GDS entièrement positive ({@code positive}) ou entièrement rassurante. */
    private static Map<String, Boolean> miniGds(boolean positive) {
        Map<String, Boolean> answers = new LinkedHashMap<>();
        answers.put("MINI_DECOURAGE", positive);
        answers.put("GDS_03", positive);
        answers.put("GDS_07", !positive);
        answers.put("GDS_14", positive);
        return answers;
    }

    private void profile(String token, boolean chronic) throws Exception {
        mvc.perform(bearer(put("/api/v1/seniors/{id}/spo2/profile", seniorId), token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("maladieRespiratoireChronique", chronic))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maladieRespiratoireChronique").value(chronic));
    }

    private org.springframework.test.web.servlet.ResultActions measure(String token, int spo2) throws Exception {
        return mvc.perform(bearer(post("/api/v1/seniors/{id}/spo2/measurements", seniorId), token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("spo2", spo2, "pouls", 72))));
    }
}
