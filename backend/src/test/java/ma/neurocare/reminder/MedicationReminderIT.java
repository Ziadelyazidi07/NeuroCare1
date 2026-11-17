package ma.neurocare.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import ma.neurocare.AbstractIntegrationTest;
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

/**
 * Traitements, génération des prises, jobs d'envoi / clôture, confirmation idempotente et
 * synchronisation hors ligne (CA-01, CA-03, CA-04, CA-06, EF-RE-07).
 */
class MedicationReminderIT extends AbstractIntegrationTest {

    private static final ZoneId CASABLANCA = ZoneId.of("Africa/Casablanca");

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
        senior = pair(aidant, seniorId);
    }

    // ---------- Traitements ----------

    @Test
    void creatingMedicationRequiresRemindersConsent() throws Exception {
        setConsent("PARTAGE_FAMILIAL", true);
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(medication("Metformine 500", List.of(horaire("08:00"))))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));
    }

    @Test
    void createListAndValidateMedication() throws Exception {
        grantReminders();

        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(medication("Metformine 500", List.of(
                                Map.of("heure", "08:00", "jours", List.of("LUN", "MER", "VEN")),
                                horaire("20:00"))))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.actif").value(true))
                .andExpect(jsonPath("$.horaires.length()").value(2))
                .andExpect(jsonPath("$.horaires[0].heure").value("08:00:00"))
                .andExpect(jsonPath("$.horaires[0].jours.length()").value(3));

        mvc.perform(bearer(get("/api/v1/seniors/{id}/medications", seniorId), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Horaire en double et jours vides refusés.
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(medication("X", List.of(horaire("08:00"), horaire("08:00"))))))
                .andExpect(status().isBadRequest());
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(medication("X", List.of(Map.of("heure", "08:00", "jours", List.of()))))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unlinkedAidantCannotSeeMedicationsOrDoses() throws Exception {
        grantReminders();
        String medicationId = createMedication(soonTime());
        String stranger = newAidantToken();

        mvc.perform(bearer(get("/api/v1/seniors/{id}/medications", seniorId), stranger))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/doses", seniorId).param("date", today().toString()), stranger))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(patch("/api/v1/medications/{id}/deactivate", medicationId), stranger))
                .andExpect(status().isNotFound());
    }

    // ---------- Génération et jobs ----------

    @Test
    void creationGeneratesUpcomingDosesAndJobsNotifyThenClose() throws Exception {
        grantReminders();
        createMedication(soonTime());

        DoseEvent dose = nextPendingDose();
        assertThat(dose.getDatePrevue()).isAfter(Instant.now().minusSeconds(60));

        // Rappel pas encore dû : rien n'est envoyé.
        reminderService.dispatchDue(dose.getDatePrevue().minusSeconds(1));
        assertThat(reload(dose).isNotificationEnvoyee()).isFalse();

        // CA-01 : à l'heure prévue, la notification est envoyée.
        reminderService.dispatchDue(dose.getDatePrevue());
        assertThat(reload(dose).isNotificationEnvoyee()).isTrue();
        assertThat(reload(dose).isRelanceEnvoyee()).isFalse();

        // EF-RE-05 : relance unique à +10 min.
        reminderService.dispatchDue(dose.getDatePrevue().plus(Duration.ofMinutes(10)));
        assertThat(reload(dose).isRelanceEnvoyee()).isTrue();

        // CA-03 : à +30 min (délai par défaut), SANS_REPONSE.
        reminderService.closeExpired(dose.getDatePrevue().plus(Duration.ofMinutes(29)));
        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.EN_ATTENTE);
        List<UUID> closed = reminderService.closeExpired(dose.getDatePrevue().plus(Duration.ofMinutes(31)));
        assertThat(closed).contains(dose.getId());
        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);
    }

    @Test
    void dailyGenerationIsIdempotent() throws Exception {
        grantReminders();
        createMedication(soonTime());
        long before = doseRepository.count();

        reminderService.generateFrom(today());
        long afterFirst = doseRepository.count();
        reminderService.generateFrom(today());

        assertThat(afterFirst).isGreaterThanOrEqualTo(before);
        assertThat(doseRepository.count()).isEqualTo(afterFirst);
    }

    // ---------- Confirmation ----------

    @Test
    void confirmationIsIdempotentWithSameKeyAndConflictsOtherwise() throws Exception {
        grantReminders();
        createMedication(soonTime());
        DoseEvent dose = nextPendingDose();
        String key = UUID.randomUUID().toString();

        MvcResult first = confirm(dose.getId(), key).andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("CONFIRME"))
                .andReturn();
        // CA-04 : même clé → même réponse, aucun doublon.
        MvcResult replay = confirm(dose.getId(), key).andExpect(status().isOk()).andReturn();
        assertThat(replay.getResponse().getContentAsString()).isEqualTo(first.getResponse().getContentAsString());

        confirm(dose.getId(), UUID.randomUUID().toString())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"));
    }

    @Test
    void seniorCannotConfirmSomeoneElsesDoseAndAidantCannotConfirm() throws Exception {
        grantReminders();
        createMedication(soonTime());
        DoseEvent dose = nextPendingDose();

        String otherSenior = pair(aidant, createSenior(aidant));
        mvc.perform(bearer(post("/api/v1/doses/{id}/confirm", dose.getId()), otherSenior))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(post("/api/v1/doses/{id}/confirm", dose.getId()), aidant))
                .andExpect(status().isForbidden());
    }

    @Test
    void offlineSyncAppliesEachItemIndependently() throws Exception {
        grantReminders();
        createMedication(soonTime());
        DoseEvent dose = nextPendingDose();

        Map<String, Object> ok = Map.of("doseId", dose.getId(), "clientRequestId", "offline-1",
                "horodatageClient", dose.getDatePrevue().plusSeconds(30).toString());
        Map<String, Object> unknown = Map.of("doseId", UUID.randomUUID(), "clientRequestId", "offline-2",
                "horodatageClient", Instant.now().toString());

        mvc.perform(bearer(post("/api/v1/me/doses/sync"), senior).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("confirmations", List.of(ok, unknown)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultats[0].resultat").value("APPLIQUEE"))
                .andExpect(jsonPath("$.resultats[0].statut").value("CONFIRME"))
                .andExpect(jsonPath("$.resultats[1].resultat").value("INTROUVABLE"));

        // Renvoi du même lot (réseau instable) : idempotent.
        mvc.perform(bearer(post("/api/v1/me/doses/sync"), senior).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("confirmations", List.of(ok)))))
                .andExpect(jsonPath("$.resultats[0].resultat").value("DEJA_APPLIQUEE"));
    }

    @Test
    void offlineConfirmationAfterClosureFollowsClientTimestamp() throws Exception {
        grantReminders();
        createMedication(soonTime());
        // Prises des jours précédents (traitement commencé il y a 3 jours), puis clôture réelle.
        reminderService.generateFrom(today().minusDays(2));
        Instant now = Instant.now();
        List<DoseEvent> past = pendingDoses().stream()
                .filter(d -> d.getDatePrevue().isBefore(now.minus(Duration.ofHours(1))))
                .toList();
        assertThat(past).hasSizeGreaterThanOrEqualTo(2);
        DoseEvent early = past.get(0);
        DoseEvent late = past.get(1);
        reminderService.closeExpired(now);
        assertThat(reload(early).getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);

        // Confirmée hors ligne avant la clôture → acceptée ; après la clôture → refusée et auditée.
        Map<String, Object> beforeClosure = Map.of("doseId", early.getId(), "clientRequestId", "c-1",
                "horodatageClient", early.getDatePrevue().plusSeconds(60).toString());
        Map<String, Object> afterClosure = Map.of("doseId", late.getId(), "clientRequestId", "c-2",
                "horodatageClient", late.getDatePrevue().plus(Duration.ofMinutes(31)).toString());

        mvc.perform(bearer(post("/api/v1/me/doses/sync"), senior).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("confirmations", List.of(beforeClosure, afterClosure)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultats[0].resultat").value("APPLIQUEE"))
                .andExpect(jsonPath("$.resultats[0].statut").value("CONFIRME"))
                .andExpect(jsonPath("$.resultats[1].resultat").value("REFUSEE"))
                .andExpect(jsonPath("$.resultats[1].statut").value("SANS_REPONSE"));

        assertThat(auditLogs.findByCibleIdOrderByHorodatageDesc(late.getId()))
                .extracting(a -> a.getAction())
                .contains("DOSE_CONFIRMATION_AFTER_CLOSURE");
    }

    // ---------- Désactivation ----------

    @Test
    void deactivatingMedicationTurnsPendingDosesGreyNeverNoResponse() throws Exception {
        grantReminders();
        String medicationId = createMedication(soonTime());
        DoseEvent dose = nextPendingDose();

        mvc.perform(bearer(patch("/api/v1/medications/{id}/deactivate", medicationId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.actif").value(false));

        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.DESACTIVE);
        reminderService.closeExpired(dose.getDatePrevue().plus(Duration.ofHours(2)));
        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.DESACTIVE);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/medications", seniorId), aidant))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void revokingRemindersConsentDeactivatesPendingDoses() throws Exception {
        grantReminders();
        createMedication(soonTime());
        DoseEvent dose = nextPendingDose();

        setConsent("RAPPELS", false);

        assertThat(reload(dose).getStatut()).isEqualTo(DoseStatus.DESACTIVE);
    }

    @Test
    void removingATimeDeactivatesItsDosesAndAddingOneGeneratesNew() throws Exception {
        grantReminders();
        LocalTime first = soonTime();
        String medicationId = createMedication(first);
        DoseEvent oldDose = nextPendingDose();
        LocalTime second = first.plusMinutes(2);

        mvc.perform(bearer(put("/api/v1/medications/{id}", medicationId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(medication("Metformine 1000", List.of(horaire(second.toString()))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nomMedicament").value("Metformine 1000"))
                .andExpect(jsonPath("$.horaires.length()").value(1));

        assertThat(reload(oldDose).getStatut()).isEqualTo(DoseStatus.DESACTIVE);
        assertThat(pendingDoses()).isNotEmpty()
                .allSatisfy(d -> assertThat(LocalTime.ofInstant(d.getDatePrevue(), CASABLANCA)).isEqualTo(second));
    }

    @Test
    void seniorAndAuthorizedAidantReadDosesOfTheDay() throws Exception {
        grantReminders();
        createMedication(soonTime());
        DoseEvent dose = nextPendingDose();
        LocalDate day = LocalDate.ofInstant(dose.getDatePrevue(), CASABLANCA);

        mvc.perform(bearer(get("/api/v1/me/doses/upcoming"), senior))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nomMedicament").value("Metformine 500"))
                .andExpect(jsonPath("$[0].statut").value("EN_ATTENTE"));

        // PARTAGE_FAMILIAL révoqué : l'aidant ne lit plus les prises (CA-05).
        setConsent("PARTAGE_FAMILIAL", false);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/doses", seniorId).param("date", day.toString()), aidant))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));

        setConsent("PARTAGE_FAMILIAL", true);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/doses", seniorId).param("date", day.toString()), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + dose.getId() + "')]").exists());
    }

    @Test
    void seniorAndAidantRegisterFcmTokens() throws Exception {
        Map<String, String> seniorDevice = Map.of("plateforme", "ANDROID", "fcmToken", "fcm-senior-" + UUID.randomUUID());
        mvc.perform(bearer(post("/api/v1/me/devices"), senior).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(seniorDevice)))
                .andExpect(status().isNoContent());
        // Le token est rattaché à l'appareil appairé (pas de nouvel appareil créé).
        mvc.perform(bearer(get("/api/v1/seniors/{id}/devices", seniorId), aidant))
                .andExpect(jsonPath("$.length()").value(1));

        mvc.perform(bearer(post("/api/v1/me/devices"), aidant).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("plateforme", "IOS", "fcmToken", "fcm-aidant-" + UUID.randomUUID()))))
                .andExpect(status().isNoContent());
        mvc.perform(bearer(post("/api/v1/me/devices"), aidant).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("plateforme", "IOS"))))
                .andExpect(status().isBadRequest());
    }

    // ---------- Helpers ----------

    private static LocalDate today() {
        return LocalDate.now(CASABLANCA);
    }

    /** Heure locale dans ~3 minutes : la prise du jour (ou du lendemain après minuit) est générée. */
    private static LocalTime soonTime() {
        return LocalTime.now(CASABLANCA).plusMinutes(3).truncatedTo(ChronoUnit.MINUTES);
    }

    private static Map<String, Object> horaire(String heure) {
        return Map.of("heure", heure, "jours", List.of("LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"));
    }

    private static Map<String, Object> medication(String nom, List<Map<String, Object>> horaires) {
        Map<String, Object> body = new HashMap<>();
        body.put("nomMedicament", nom);
        body.put("consigne", "1 comprimé pendant le repas");
        body.put("dateDebut", today().minusDays(3).toString());
        body.put("horaires", horaires);
        return body;
    }

    private String createMedication(LocalTime time) throws Exception {
        return createMedication(time, "Metformine 500");
    }

    private String createMedication(LocalTime time, String nom) throws Exception {
        MvcResult result = mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(medication(nom, List.of(horaire(time.toString()))))))
                .andExpect(status().isCreated())
                .andReturn();
        return read(result, "$.id");
    }

    /** Lien actif (PARTAGE_FAMILIAL, EF-CO-01) + RAPPELS : conditions pour gérer les traitements (§8.3). */
    private void grantReminders() throws Exception {
        setConsent("PARTAGE_FAMILIAL", true);
        setConsent("RAPPELS", true);
    }

    private void setConsent(String type, boolean accorde) throws Exception {
        mvc.perform(bearer(put("/api/v1/seniors/{id}/consents/{type}", seniorId, type), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("accorde", accorde, "versionTexte", "v1",
                                "presenceSeniorConfirmee", true))))
                .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions confirm(UUID doseId, String key) throws Exception {
        return mvc.perform(bearer(post("/api/v1/doses/{id}/confirm", doseId), senior)
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("horodatageClient", Instant.now().toString()))));
    }

    private List<DoseEvent> pendingDoses() {
        UUID id = UUID.fromString(seniorId);
        return doseRepository.findForSenior(id, Instant.now().minus(Duration.ofDays(4)),
                        Instant.now().plus(Duration.ofDays(4))).stream()
                .filter(d -> d.getStatut() == DoseStatus.EN_ATTENTE)
                .toList();
    }

    private DoseEvent nextPendingDose() {
        List<DoseEvent> pending = pendingDoses();
        assertThat(pending).as("prises EN_ATTENTE générées").isNotEmpty();
        return pending.getFirst();
    }

    private DoseEvent reload(DoseEvent dose) {
        return doseRepository.findById(dose.getId()).orElseThrow();
    }

    private String pair(String aidantToken, String targetSeniorId) throws Exception {
        MvcResult code = mvc.perform(bearer(post("/api/v1/seniors/{id}/pairing-codes", targetSeniorId), aidantToken))
                .andExpect(status().isCreated()).andReturn();
        MvcResult redeemed = mvc.perform(post("/api/v1/auth/pairing/redeem")
                        .with(r -> {
                            r.setRemoteAddr(randomIp());
                            return r;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("code", read(code, "$.code"), "plateforme", "ANDROID"))))
                .andExpect(status().isOk()).andReturn();
        return read(redeemed, "$.deviceToken");
    }
}
