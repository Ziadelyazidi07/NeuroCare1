package ma.neurocare.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import ma.neurocare.AbstractIntegrationTest;
import ma.neurocare.audit.domain.AuditLog;
import ma.neurocare.audit.infrastructure.AuditLogRepository;
import ma.neurocare.reminder.application.ReminderService;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.reminder.infrastructure.DoseEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** Tableau de bord (EF-DA-01, 03), exercices (EF-CG-01 à 04), audit des lectures (§8.4), CA-05, CA-09. */
class DashboardCognitiveIT extends AbstractIntegrationTest {

    private static final ZoneId CASABLANCA = ZoneId.of("Africa/Casablanca");
    private static final List<String> FORBIDDEN_KEYS =
            List.of("score", "risque", "risk", "diagnos", "probab", "alzheimer", "pathologi", "normal", "oubli");

    @Autowired
    ReminderService reminderService;

    @Autowired
    DoseEventRepository doseRepository;

    @Autowired
    AuditLogRepository auditLogs;

    private String aidant;
    private String seniorId;
    private String senior;

    @BeforeEach
    void setUp() throws Exception {
        aidant = newAidantToken();
        seniorId = createSenior(aidant);
        senior = pairDevice(aidant, seniorId);
    }

    // ---------- Tableau de bord ----------

    @Test
    void dashboardRequiresFamilySharingAndLinkedCaregiver() throws Exception {
        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), aidant))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED")); // CA-05
        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), newAidantToken()))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), senior))
                .andExpect(status().isForbidden());
    }

    @Test
    void todayShowsColouredPillsAndHistoryComputesTheRate() throws Exception {
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        giveConsent(aidant, seniorId, "RAPPELS", true);
        createMedicationEveryTwoHours();
        LocalDate today = LocalDate.now(CASABLANCA);
        reminderService.generateFrom(today); // les 12 prises du jour, y compris celles déjà passées
        reminderService.closeExpired(Instant.now());
        DoseEvent toConfirm = todayDoses(today).stream().filter(d -> d.getStatut() == DoseStatus.EN_ATTENTE)
                .findFirst().orElse(null);
        if (toConfirm != null) {
            mvc.perform(bearer(post("/api/v1/doses/{id}/confirm", toConfirm.getId()), senior)
                    .header("Idempotency-Key", UUID.randomUUID().toString())).andExpect(status().isOk());
        }

        MvcResult result = mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(today.toString()))
                .andExpect(jsonPath("$.prises.length()").value(12))
                .andExpect(jsonPath("$.resume.total").value(12))
                .andExpect(jsonPath("$.avertissement").exists())
                .andReturn();
        JsonNode body = json.readTree(result.getResponse().getContentAsString());
        int confirmees = 0;
        int sansReponse = 0;
        for (JsonNode prise : body.get("prises")) {
            String expected = switch (prise.get("statut").asText()) {
                case "CONFIRME" -> "VERT";
                case "SANS_REPONSE" -> "ORANGE";
                default -> "GRIS";
            };
            assertThat(prise.get("couleur").asText()).isEqualTo(expected);
            confirmees += "CONFIRME".equals(prise.get("statut").asText()) ? 1 : 0;
            sansReponse += "SANS_REPONSE".equals(prise.get("statut").asText()) ? 1 : 0;
        }
        assertThat(body.at("/resume/confirmees").asInt()).isEqualTo(confirmees);
        assertThat(body.at("/resume/sansReponse").asInt()).isEqualTo(sansReponse);

        MvcResult history = mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/history", seniorId), aidant)
                        .param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jours.length()").value(7))
                .andExpect(jsonPath("$.jours[6].date").value(today.toString()))
                .andExpect(jsonPath("$.jours[6].confirmees").value(confirmees))
                .andExpect(jsonPath("$.jours[6].sansReponse").value(sansReponse))
                .andReturn();
        JsonNode lastDay = json.readTree(history.getResponse().getContentAsString()).at("/jours/6");
        if (confirmees + sansReponse > 0) {
            assertThat(lastDay.get("tauxConfirmation").asDouble())
                    .isCloseTo(confirmees * 100.0 / (confirmees + sansReponse), org.assertj.core.data.Offset.offset(0.01));
        }

        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/history", seniorId), aidant).param("days", "31"))
                .andExpect(status().isBadRequest());

        // §8.4 : chaque lecture de données de santé est tracée.
        assertThat(auditLogs.findByCibleIdOrderByHorodatageDesc(UUID.fromString(seniorId)))
                .extracting(AuditLog::getAction)
                .contains("READ_DASHBOARD", "READ_HISTORY");
    }

    // ---------- Exercices ----------

    @Test
    void exerciseRequiresSeniorAndExercisesConsent() throws Exception {
        mvc.perform(bearer(get("/api/v1/me/cognitive/next"), senior))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));
        mvc.perform(bearer(get("/api/v1/me/cognitive/next"), aidant))
                .andExpect(status().isForbidden());
    }

    @Test
    void drawThenRecordRawResultWithoutClinicalLabel() throws Exception {
        giveConsent(aidant, seniorId, "EXERCICES", true);
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);

        MvcResult drawn = mvc.perform(bearer(get("/api/v1/me/cognitive/next"), senior).param("nombre", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("RAPPEL_MOTS"))
                .andExpect(jsonPath("$.langue").value("DARIJA"))
                .andExpect(jsonPath("$.motsPresentes.length()").value(4))
                .andExpect(jsonPath("$.propositions.length()").value(9))
                .andExpect(jsonPath("$.motsPresentes[0].ecritureArabe").exists())
                .andExpect(jsonPath("$.facultatif").value(true))
                .andReturn();
        List<String> presentes = read(drawn, "$.motsPresentes[*].mot");
        List<String> propositions = read(drawn, "$.propositions[*].mot");
        List<String> choisis = new ArrayList<>(presentes.subList(0, 3));

        Map<String, Object> body = new HashMap<>();
        body.put("type", "RAPPEL_MOTS");
        body.put("motsPresentes", presentes);
        body.put("propositions", propositions);
        body.put("motsChoisis", choisis);
        body.put("delaiRappelSec", 60);
        body.put("tempsReponseMs", List.of(3200, 4100, 6900));
        body.put("dureeSec", 95);
        body.put("interrompu", false);
        MvcResult saved = mvc.perform(bearer(post("/api/v1/me/cognitive/sessions"), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.corrects").value(3))
                .andExpect(jsonPath("$.motsPresentes").value(4))
                .andExpect(jsonPath("$.tauxReussite").value(75.0))
                .andExpect(jsonPath("$.resultatBrut.mots_presentes.length()").value(4))
                .andExpect(jsonPath("$.resultatBrut.mots_choisis.length()").value(3))
                .andExpect(jsonPath("$.resultatBrut.temps_reponse_ms[2]").value(6900))
                .andReturn();
        assertNoClinicalKeys(saved); // CA-09

        // Interruption sans pénalité : pas de taux.
        body.put("motsChoisis", List.of());
        body.put("interrompu", true);
        mvc.perform(bearer(post("/api/v1/me/cognitive/sessions"), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.interrompu").value(true))
                .andExpect(jsonPath("$.tauxReussite").doesNotExist());

        // Historique descriptif pour l'aidant, avec la mention de non-diagnostic.
        MvcResult history = mvc.perform(bearer(get("/api/v1/seniors/{id}/cognitive/sessions", seniorId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessions.length()").value(2))
                .andExpect(jsonPath("$.avertissement").value(org.hamcrest.Matchers.containsString("diagnostic")))
                .andReturn();
        assertNoClinicalKeys(history);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), aidant))
                .andExpect(jsonPath("$.dernierExercice.interrompu").value(true));
        assertThat(auditLogs.findByCibleIdOrderByHorodatageDesc(UUID.fromString(seniorId)))
                .extracting(AuditLog::getAction).contains("READ_COGNITIVE_SESSIONS");
    }

    @Test
    void inconsistentOrUnsupportedExercisesAreRejected() throws Exception {
        giveConsent(aidant, seniorId, "EXERCICES", true);
        mvc.perform(bearer(get("/api/v1/me/cognitive/next"), senior).param("type", "ASSOCIATION_VISUELLE"))
                .andExpect(status().isBadRequest());
        mvc.perform(bearer(get("/api/v1/me/cognitive/next"), senior).param("nombre", "6"))
                .andExpect(status().isBadRequest());

        Map<String, Object> body = new HashMap<>();
        body.put("type", "RAPPEL_MOTS");
        body.put("motsPresentes", List.of("khobz", "bab", "chems"));
        body.put("propositions", List.of("khobz", "ma", "bab", "kas", "chems", "dar", "zit", "ward", "qmar"));
        body.put("motsChoisis", List.of("inconnu"));
        body.put("delaiRappelSec", 60);
        body.put("interrompu", false);
        mvc.perform(bearer(post("/api/v1/me/cognitive/sessions"), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        body.put("motsChoisis", List.of("khobz"));
        body.put("motsPresentes", List.of("pain", "porte", "eau")); // mots français pour un senior en darija
        body.put("propositions", List.of("pain", "porte", "eau", "soleil", "verre", "maison", "huile", "rose", "lune"));
        mvc.perform(bearer(post("/api/v1/me/cognitive/sessions"), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isBadRequest());
    }

    // ---------- Helpers ----------

    private void assertNoClinicalKeys(MvcResult result) throws Exception {
        List<String> keys = new ArrayList<>();
        collectKeys(json.readTree(result.getResponse().getContentAsString()), keys);
        assertThat(keys).noneMatch(k -> FORBIDDEN_KEYS.stream().anyMatch(k.toLowerCase(Locale.ROOT)::contains));
    }

    private static void collectKeys(JsonNode node, List<String> keys) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                keys.add(field.getKey());
                collectKeys(field.getValue(), keys);
            }
        } else if (node.isArray()) {
            node.forEach(child -> collectKeys(child, keys));
        }
    }

    private void createMedicationEveryTwoHours() throws Exception {
        List<Map<String, Object>> horaires = new ArrayList<>();
        for (int h = 0; h < 24; h += 2) {
            horaires.add(Map.of("heure", "%02d:00".formatted(h),
                    "jours", List.of("LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM")));
        }
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomMedicament", "Metformine 500",
                                "dateDebut", LocalDate.now(CASABLANCA).minusDays(1).toString(),
                                "horaires", horaires))))
                .andExpect(status().isCreated());
    }

    private List<DoseEvent> todayDoses(LocalDate today) {
        return doseRepository.findForSenior(UUID.fromString(seniorId), today.atStartOfDay(CASABLANCA).toInstant(),
                today.plusDays(1).atStartOfDay(CASABLANCA).toInstant());
    }
}
