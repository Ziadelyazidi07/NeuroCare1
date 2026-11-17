package ma.neurocare.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ma.neurocare.AbstractIntegrationTest;
import ma.neurocare.TestcontainersConfig;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.reminder.application.ReminderService;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.reminder.infrastructure.DoseEventRepository;
import ma.neurocare.report.ReportIT;
import ma.neurocare.report.application.WeeklyReport;
import ma.neurocare.support.RecordingPushNotificationService;
import ma.neurocare.support.RecordingPushNotificationService.Sent;
import ma.neurocare.support.StompTestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Critères d'acceptation du cahier des charges (§14.2, CA-01 à CA-10), de bout en bout : vrai serveur
 * HTTP + WebSocket, PostgreSQL 16, service audio arrêté, envois push enregistrés.
 *
 * <p>Les jobs planifiés sont appelés directement avec l'instant voulu (horloge simulée) : c'est
 * exactement ce que fait {@code ReminderScheduler} à chaque tick.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({TestcontainersConfig.class, RecordingPushNotificationService.Config.class})
@DisplayName("Critères d'acceptation CA-01 à CA-10 (cahier §14.2)")
class AcceptanceCriteriaIT extends AbstractIntegrationTest {

    private static final ZoneId CASABLANCA = ZoneId.of("Africa/Casablanca");
    private static final List<String> CLINICAL_LABELS =
            List.of("score", "risque", "risk", "diagnos", "probab", "alzheimer", "pathologi", "normal", "oubli");

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    ReminderService reminderService;

    @Autowired
    DoseEventRepository doses;

    @Autowired
    RecordingPushNotificationService push;

    @Autowired
    NeuroCareProperties properties;

    @Autowired
    JdbcTemplate jdbc;

    private String aidant;
    private String seniorId;
    private String senior;
    private String seniorFcm;
    private String aidantFcm;

    /** Aidante au lien validé (PARTAGE_FAMILIAL + RAPPELS), téléphone senior appairé, tokens FCM enregistrés. */
    @BeforeEach
    void givenSalmaAndHajjAhmed() throws Exception {
        aidant = newAidantToken();
        seniorId = createSenior(aidant);
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        giveConsent(aidant, seniorId, "RAPPELS", true);
        senior = pairDevice(aidant, seniorId);
        seniorFcm = "fcm-senior-" + UUID.randomUUID();
        aidantFcm = "fcm-aidant-" + UUID.randomUUID();
        registerFcm(senior, seniorFcm, "ANDROID");
        registerFcm(aidant, aidantFcm, "IOS");
    }

    @Test
    @DisplayName("CA-01 — à l'heure prévue, une prise EN_ATTENTE existe et la notification part en moins de 60 s")
    void ca01_reminderSentOnTime() throws Exception {
        DoseEvent dose = medicationWithUpcomingDose();
        assertThat(dose.getStatut()).isEqualTo(DoseStatus.EN_ATTENTE);

        reminderService.dispatchDue(dose.getDatePrevue().minusSeconds(1));
        assertThat(push.sentTo(seniorFcm)).isEmpty();

        // Le job d'envoi tourne à chaque tick (≤ 60 s) : à l'heure prévue, le rappel part.
        assertThat(properties.reminder().tick()).isLessThanOrEqualTo(Duration.ofSeconds(60));
        reminderService.dispatchDue(dose.getDatePrevue());
        Sent sent = awaitPush(seniorFcm, "DOSE_REMINDER", dose.getId());
        assertThat(sent.data()).containsEntry("medication", "Metformine 500").containsEntry("relance", "false");
        assertThat(reload(dose).isNotificationEnvoyee()).isTrue();
    }

    @Test
    @DisplayName("CA-02 — « C'est fait » → CONFIRME et pastille verte chez l'aidant en moins de 2 s")
    void ca02_confirmationTurnsGreenInRealTime() throws Exception {
        DoseEvent dose = medicationWithUpcomingDose();
        try (StompTestClient salma = StompTestClient.connect(port, aidant, objectMapper).subscribeToSenior(seniorId)) {
            long start = System.nanoTime();
            confirm(dose.getId(), UUID.randomUUID().toString()).andExpect(status().isOk())
                    .andExpect(jsonPath("$.statut").value("CONFIRME"));

            Map<String, Object> event = salma.await(e -> dose.getId().toString().equals(e.get("doseId")),
                    Duration.ofSeconds(2));
            assertThat(event).as("pastille reçue en moins de 2 s").isNotNull();
            assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(2));
            assertThat(event).containsEntry("statut", "CONFIRME").containsEntry("couleur", "VERT");
        }
        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.CONFIRME);
    }

    @Test
    @DisplayName("CA-03 — sans action pendant 30 min, SANS_REPONSE et alerte orange à l'aidant")
    void ca03_noResponseAfterThirtyMinutes() throws Exception {
        DoseEvent dose = medicationWithUpcomingDose();
        try (StompTestClient salma = StompTestClient.connect(port, aidant, objectMapper).subscribeToSenior(seniorId)) {
            reminderService.closeExpired(dose.getDatePrevue().plus(Duration.ofMinutes(29)));
            assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.EN_ATTENTE);

            reminderService.closeExpired(dose.getDatePrevue().plus(Duration.ofMinutes(30)).plusSeconds(1));
            assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);

            Map<String, Object> alert = salma.await(e -> dose.getId().toString().equals(e.get("doseId")),
                    Duration.ofSeconds(2));
            assertThat(alert).isNotNull().containsEntry("statut", "SANS_REPONSE").containsEntry("couleur", "ORANGE");
        }
        // Alerte aussi envoyée en push à l'aidante, sans donnée de santé dans le message.
        Sent pushAlert = awaitPush(aidantFcm, "DOSE_NO_RESPONSE", dose.getId());
        assertThat(pushAlert.data()).containsEntry("couleur", "ORANGE").doesNotContainKey("medication");
    }

    @Test
    @DisplayName("CA-04 — même requête rejouée avec la même clé : réponse identique, aucun doublon")
    void ca04_idempotentConfirmation() throws Exception {
        DoseEvent dose = medicationWithUpcomingDose();
        String key = UUID.randomUUID().toString();

        String first = confirm(dose.getId(), key).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String replay = confirm(dose.getId(), key).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(replay).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM dose_events WHERE schedule_id = ? AND date_prevue = ?",
                Integer.class, dose.getScheduleId(), java.sql.Timestamp.from(dose.getDatePrevue()))).isEqualTo(1);
        assertThat(reload(dose).getClientRequestId()).isEqualTo(key);
        confirm(dose.getId(), UUID.randomUUID().toString()).andExpect(status().isConflict());
    }

    @Test
    @DisplayName("CA-05 — PARTAGE_FAMILIAL révoqué : 403 CONSENT_REQUIRED sur le tableau de bord")
    void ca05_revokedFamilySharing() throws Exception {
        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), aidant)).andExpect(status().isOk());

        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", false);

        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/today", seniorId), aidant))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"))
                .andExpect(jsonPath("$.type").value("https://neurocare.ma/errors/consent-required"));
    }

    @Test
    @DisplayName("CA-06 — aidant non lié : 404 sur les prises d'un senior")
    void ca06_unlinkedCaregiverGets404() throws Exception {
        String stranger = newAidantToken();

        mvc.perform(bearer(get("/api/v1/seniors/{id}/doses", seniorId), stranger)
                        .param("date", LocalDate.now(CASABLANCA).toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    @DisplayName("CA-07 — service audio arrêté : le rappel part avec le TTS standard ou l'audio préenregistré")
    void ca07_audioFallbackWhenServiceIsDown() throws Exception {
        // Profil de test : aucun service audio à l'écoute.
        DoseEvent dose = medicationWithUpcomingDose();

        reminderService.dispatchDue(dose.getDatePrevue());

        Sent reminder = awaitPush(seniorFcm, "DOSE_REMINDER", dose.getId());
        assertThat(reminder.data().get("audioSource")).isIn("TTS_STANDARD", "PREENREGISTRE");
        MvcResult preview = mvc.perform(bearer(post("/api/v1/medications/{id}/audio/preview", medicationId(dose)), aidant))
                .andExpect(status().isOk())
                .andReturn();
        assertThat((String) read(preview, "$.source")).isIn("TTS_STANDARD", "PREENREGISTRE");
    }

    @Test
    @DisplayName("CA-08 — une semaine de données → PDF avec l'avertissement de non-diagnostic en moins de 3 s")
    void ca08_weeklyPdf() throws Exception {
        DoseEvent dose = medicationWithUpcomingDose();
        confirm(dose.getId(), UUID.randomUUID().toString()).andExpect(status().isOk());
        LocalDate monday = LocalDate.now(CASABLANCA).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        long start = System.nanoTime();
        MvcResult pdf = mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), aidant)
                        .param("weekStart", monday.toString()))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(3));

        assertThat(pdf.getResponse().getContentType()).isEqualTo(MediaType.APPLICATION_PDF_VALUE);
        assertThat(pdf.getResponse().getHeader("Content-Disposition")).startsWith("attachment");
        assertThat(ReportIT.pdfText(pdf.getResponse().getContentAsByteArray()))
                .contains(ReportIT.normalize(WeeklyReport.AVERTISSEMENT));
    }

    @Test
    @DisplayName("CA-09 — exercice terminé : résultat brut enregistré sans libellé d'interprétation clinique")
    void ca09_rawCognitiveResult() throws Exception {
        giveConsent(aidant, seniorId, "EXERCICES", true);
        MvcResult drawn = mvc.perform(bearer(get("/api/v1/me/cognitive/next"), senior)).andExpect(status().isOk()).andReturn();
        List<String> presented = read(drawn, "$.motsPresentes[*].mot");

        Map<String, Object> body = new HashMap<>();
        body.put("type", "RAPPEL_MOTS");
        body.put("motsPresentes", presented);
        body.put("propositions", read(drawn, "$.propositions[*].mot"));
        body.put("motsChoisis", presented.subList(0, 2));
        body.put("delaiRappelSec", 60);
        body.put("tempsReponseMs", List.of(3200, 4100));
        body.put("dureeSec", 80);
        body.put("interrompu", false);
        MvcResult saved = mvc.perform(bearer(post("/api/v1/me/cognitive/sessions"), senior)
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.corrects").value(2))
                .andReturn();
        MvcResult history = mvc.perform(bearer(get("/api/v1/seniors/{id}/cognitive/sessions", seniorId), aidant))
                .andExpect(status().isOk()).andReturn();

        for (MvcResult result : List.of(saved, history)) {
            assertThat(jsonKeys(result.getResponse().getContentAsString()))
                    .noneMatch(k -> CLINICAL_LABELS.stream().anyMatch(k.toLowerCase(Locale.ROOT)::contains));
        }
        // En base : uniquement les clés brutes du cahier §6.4.
        String raw = jdbc.queryForObject("SELECT resultat_brut::text FROM cognitive_sessions WHERE id = ?::uuid",
                String.class, (String) read(saved, "$.id"));
        assertThat(jsonKeys(raw)).containsExactlyInAnyOrder("mots_presentes", "propositions", "mots_choisis",
                "corrects", "delai_rappel_sec", "temps_reponse_ms");
    }

    @Test
    @DisplayName("CA-10 — mode avion : prises disponibles pour les notifications locales, confirmation synchronisée au retour du réseau")
    void ca10_offlineConfirmationIsSynchronised() throws Exception {
        DoseEvent dose = medicationWithUpcomingDose();

        // Avant de perdre le réseau, le téléphone télécharge les prises des 48 h suivantes.
        mvc.perform(bearer(get("/api/v1/me/doses/upcoming"), senior).param("hours", "48"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + dose.getId() + "')]").exists());

        // Hors ligne : la notification locale se déclenche, le senior confirme ; le serveur, sans nouvelles,
        // clôture la prise en SANS_REPONSE.
        Instant confirmedOffline = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        reminderService.closeExpired(dose.getDatePrevue().plus(Duration.ofMinutes(31)));
        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);

        try (StompTestClient salma = StompTestClient.connect(port, aidant, objectMapper).subscribeToSenior(seniorId)) {
            Map<String, Object> item = Map.of("doseId", dose.getId(), "clientRequestId", "offline-" + dose.getId(),
                    "horodatageClient", confirmedOffline.toString());
            sync(item).andExpect(jsonPath("$.resultats[0].resultat").value("APPLIQUEE"))
                    .andExpect(jsonPath("$.resultats[0].statut").value("CONFIRME"));
            assertThat(salma.await(e -> dose.getId().toString().equals(e.get("doseId"))
                    && "VERT".equals(e.get("couleur")), Duration.ofSeconds(2))).isNotNull();

            // Réseau instable : le même lot renvoyé ne change rien.
            sync(item).andExpect(jsonPath("$.resultats[0].resultat").value("DEJA_APPLIQUEE"));
        }
        assertThat(reload(dose).getHorodatageAction()).isEqualTo(confirmedOffline);
    }

    // ---------- Étapes communes ----------

    private DoseEvent medicationWithUpcomingDose() throws Exception {
        LocalTime soon = LocalTime.now(CASABLANCA).plusMinutes(5).truncatedTo(ChronoUnit.MINUTES);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomMedicament", "Metformine 500", "consigne", "1 comprimé pendant le repas",
                                "dateDebut", LocalDate.now(CASABLANCA).minusDays(1).toString(),
                                "horaires", List.of(Map.of("heure", soon.toString(),
                                        "jours", List.of("LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM")))))))
                .andExpect(status().isCreated());
        return doses.findForSenior(UUID.fromString(seniorId), Instant.now().minusSeconds(60),
                        Instant.now().plus(Duration.ofDays(4))).stream()
                .filter(d -> d.getStatut() == DoseStatus.EN_ATTENTE)
                .findFirst()
                .orElseThrow(() -> new AssertionError("aucune prise EN_ATTENTE générée"));
    }

    private org.springframework.test.web.servlet.ResultActions confirm(UUID doseId, String key) throws Exception {
        return mvc.perform(bearer(post("/api/v1/doses/{id}/confirm", doseId), senior)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("horodatageClient", Instant.now().truncatedTo(ChronoUnit.SECONDS).toString()))));
    }

    private org.springframework.test.web.servlet.ResultActions sync(Map<String, Object> item) throws Exception {
        return mvc.perform(bearer(post("/api/v1/me/doses/sync"), senior).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("confirmations", List.of(item)))));
    }

    private void registerFcm(String token, String fcm, String platform) throws Exception {
        mvc.perform(bearer(post("/api/v1/me/devices"), token).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("plateforme", platform, "fcmToken", fcm))))
                .andExpect(status().isNoContent());
    }

    private Sent awaitPush(String fcmToken, String type, UUID doseId) throws Exception {
        Sent[] found = new Sent[1];
        awaitUntil(type + " pour " + doseId, () -> {
            found[0] = push.sentTo(fcmToken).stream()
                    .filter(s -> s.type().equals(type) && doseId.toString().equals(s.data().get("doseId")))
                    .findFirst().orElse(null);
            return found[0] != null;
        });
        return found[0];
    }

    private DoseEvent reload(DoseEvent dose) {
        return doses.findById(dose.getId()).orElseThrow();
    }

    private UUID medicationId(DoseEvent dose) {
        return jdbc.queryForObject("SELECT medication_id FROM medication_schedules WHERE id = ?", UUID.class,
                dose.getScheduleId());
    }

    private List<String> jsonKeys(String jsonText) throws Exception {
        List<String> keys = new ArrayList<>();
        collect(json.readTree(jsonText), keys);
        return keys;
    }

    private static void collect(JsonNode node, List<String> keys) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                keys.add(field.getKey());
                if (!"resultatBrut".equals(field.getKey())) {
                    collect(field.getValue(), keys);
                }
            }
        } else if (node.isArray()) {
            node.forEach(child -> collect(child, keys));
        }
    }
}
