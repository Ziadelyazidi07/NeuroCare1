package ma.neurocare.screening;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import ma.neurocare.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Modules 4 (FINDRISC) et 5 (tension, automesure 3 jours) : accès, cotation et moyenne par le serveur. */
class MetabolicCardioIT extends AbstractIntegrationTest {

    private String aidant;
    private String seniorId;
    private String senior;

    @BeforeEach
    void setUp() throws Exception {
        aidant = newAidantToken();
        seniorId = createSenior(aidant);
        senior = pairDevice(aidant, seniorId);
    }

    // ---------- FINDRISC ----------

    private static Map<String, Object> findrisc() {
        Map<String, Object> body = new HashMap<>();
        body.put("age", 60);                       // 3 pts
        body.put("sexe", "HOMME");
        body.put("poidsKg", 88);
        body.put("tailleCm", 175);                 // IMC 28,7 : 1 pt
        body.put("tourTailleCm", 100);             // 3 pts
        body.put("activitePhysique", false);       // 2 pts
        body.put("fruitsLegumesQuotidiens", true); // 0 pt
        body.put("medicamentsHypertension", true); // 2 pts
        body.put("glycemieEleveeAntecedent", false);
        body.put("antecedentsFamiliaux", "ELOIGNES"); // 3 pts
        return body;
    }

    @Test
    void findriscIsScoredByTheServer() throws Exception {
        mvc.perform(bearer(post("/api/v1/seniors/{id}/findrisc/assessments", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(findrisc())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imc").value(28.7))
                .andExpect(jsonPath("$.points.tourTaille").value(3))
                .andExpect(jsonPath("$.scoreTotal").value(14))
                .andExpect(jsonPath("$.niveau").value("MODERE"))
                .andExpect(jsonPath("$.pourcentageA10Ans").value(17))
                .andExpect(jsonPath("$.avertissement").value(org.hamcrest.Matchers.containsString("pas un diagnostic")));

        mvc.perform(bearer(get("/api/v1/seniors/{id}/findrisc/assessments", seniorId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passations.length()").value(1));
    }

    @Test
    void findriscRejectsHeightInMetresAndRequiresFamilySharingForCaregivers() throws Exception {
        Map<String, Object> body = findrisc();
        body.put("tailleCm", 1.75);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/findrisc/assessments", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isBadRequest());

        mvc.perform(bearer(get("/api/v1/seniors/{id}/findrisc/assessments", seniorId), aidant))
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/findrisc/assessments", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(findrisc())))
                .andExpect(status().isCreated());
    }

    // ---------- Tension ----------

    private ResultActions measure(Map<String, Object> body) throws Exception {
        return mvc.perform(bearer(post("/api/v1/seniors/{id}/bp/measurements", seniorId), senior)
                .contentType(MediaType.APPLICATION_JSON).content(toJson(body)));
    }

    @Test
    void eachMeasurementGetsAnImmediateLevel() throws Exception {
        measure(Map.of("tas", 185, "tad", 100, "pouls", 80)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.niveau").value("URGENCE_HYPERTENSIVE"));
        measure(Map.of("tas", 150, "tad", 90, "pouls", 80)).andExpect(jsonPath("$.niveau").value("TENSION_ELEVEE"));
        measure(Map.of("tas", 120, "tad", 75, "pouls", 70)).andExpect(jsonPath("$.niveau").value("NORMALE"));
        measure(Map.of("tas", 95, "tad", 60, "pouls", 70)).andExpect(jsonPath("$.niveau").value("HYPOTENSION"));
        measure(Map.of("tas", 80, "tad", 90, "pouls", 70)).andExpect(status().isBadRequest());

        mvc.perform(bearer(get("/api/v1/seniors/{id}/bp/measurements", seniorId), senior))
                .andExpect(jsonPath("$.mesures.length()").value(4));
    }

    @Test
    void threeDayProtocolAveragesItsEighteenMeasures() throws Exception {
        String serieId = read(mvc.perform(bearer(post("/api/v1/seniors/{id}/bp/series", seniorId), senior)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("dateDebut", LocalDate.now().toString()))))
                .andExpect(status().isCreated())
                .andReturn(), "$.id");

        for (int jour = 1; jour <= 3; jour++) {
            for (String moment : new String[] {"MATIN", "SOIR"}) {
                for (int rang = 1; rang <= 3; rang++) {
                    measure(Map.of("tas", 140, "tad", 80, "pouls", 70, "serieId", serieId, "jour", jour,
                            "moment", moment, "rang", rang)).andExpect(status().isCreated());
                }
            }
        }
        // Une ressaisie remplace le créneau au lieu d'ajouter une 19e mesure.
        measure(Map.of("tas", 122, "tad", 80, "pouls", 70, "serieId", serieId, "jour", 3, "moment", "SOIR", "rang", 3))
                .andExpect(status().isCreated());
        measure(Map.of("tas", 122, "tad", 80, "pouls", 70, "serieId", serieId, "jour", 3))
                .andExpect(status().isBadRequest());

        mvc.perform(bearer(get("/api/v1/seniors/{id}/bp/series", seniorId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series[0].nombreMesures").value(18))
                .andExpect(jsonPath("$.series[0].complet").value(true))
                .andExpect(jsonPath("$.series[0].moyenneTas").value(139.0))
                .andExpect(jsonPath("$.series[0].moyenneAuDessusDuSeuil").value(true))
                .andExpect(jsonPath("$.series[0].mesures[0].jour").value(1))
                .andExpect(jsonPath("$.series[0].mesures[0].moment").value("MATIN"));

        // Un protocole d'un autre senior n'est pas accessible.
        String otherAidant = newAidantToken();
        String otherSenior = createSenior(otherAidant);
        String otherDevice = pairDevice(otherAidant, otherSenior);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/bp/measurements", otherSenior), otherDevice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("tas", 120, "tad", 80, "pouls", 70, "serieId", serieId, "jour", 1,
                                "moment", "MATIN", "rang", 1))))
                .andExpect(status().isNotFound());
    }
}
