package ma.neurocare.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import ma.neurocare.AbstractIntegrationTest;
import ma.neurocare.audit.domain.AuditLog;
import ma.neurocare.audit.infrastructure.AuditLogRepository;
import ma.neurocare.reminder.application.ReminderService;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.reminder.infrastructure.DoseEventRepository;
import ma.neurocare.report.application.WeeklyReport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** CA-08 : une semaine de données → PDF avec avertissement de non-diagnostic, en moins de 3 s, tracé. */
public class ReportIT extends AbstractIntegrationTest {

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
    private LocalDate lastWeek;

    @BeforeEach
    void setUp() throws Exception {
        aidant = newAidantToken();
        MvcResult created = mvc.perform(bearer(post("/api/v1/seniors"), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomComplet", "Hajj Ahmed", "anneeNaissance", 1952,
                                "lienParente", "fille", "surnomSenior", "Baba", "donneesFictives", true))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.anneeNaissance").value(1952))
                .andReturn();
        seniorId = read(created, "$.id");
        senior = pairDevice(aidant, seniorId);
        lastWeek = LocalDate.now(CASABLANCA).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    }

    @Test
    void weeklyPdfIsGeneratedQuicklyWithMandatoryWarningAndAudited() throws Exception {
        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        giveConsent(aidant, seniorId, "RAPPELS", true);
        createMedication();
        // Prises du lundi au mercredi de la semaine dernière, une confirmée puis les autres clôturées.
        reminderService.generateFrom(lastWeek);
        DoseEvent first = doseRepository.findForSenior(UUID.fromString(seniorId),
                lastWeek.atStartOfDay(CASABLANCA).toInstant(), lastWeek.plusDays(7).atStartOfDay(CASABLANCA).toInstant())
                .getFirst();
        mvc.perform(bearer(post("/api/v1/me/doses/sync"), senior).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("confirmations", List.of(Map.of("doseId", first.getId(),
                                "clientRequestId", "rapport-1",
                                "horodatageClient", first.getDatePrevue().plusSeconds(180).toString()))))))
                .andExpect(status().isOk());
        reminderService.closeExpired(Instant.now());

        long start = System.nanoTime();
        MvcResult result = mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), aidant)
                        .param("weekStart", lastWeek.toString())
                        .param("observations", "Plus fatigué le soir."))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", MediaType.APPLICATION_PDF_VALUE))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"neurocare-rapport-%d-W%02d.pdf\"".formatted(
                                lastWeek.get(IsoFields.WEEK_BASED_YEAR), lastWeek.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR))))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andReturn();
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(3));

        String text = pdfText(result.getResponse().getContentAsByteArray());
        assertThat(text).contains(normalize(WeeklyReport.AVERTISSEMENT))
                .contains("Hajj Ahmed", "Salma B.", "DONNÉES FICTIVES", "Metformine 500", "Confirmé", "Sans réponse",
                        "Plus fatigué le soir.");
        assertThat(text).containsPattern("\\d{2} ans");

        assertThat(auditLogs.findByCibleIdOrderByHorodatageDesc(UUID.fromString(seniorId)))
                .extracting(AuditLog::getAction).contains("EXPORT_PDF");
        assertThat(doseRepository.findById(first.getId()).orElseThrow().getStatut()).isEqualTo(DoseStatus.CONFIRME);
    }

    @Test
    void accessRulesAndValidation() throws Exception {
        // CA-05 : sans PARTAGE_FAMILIAL, pas de rapport.
        mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), aidant)
                        .param("weekStart", lastWeek.toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONSENT_REQUIRED"));

        giveConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), newAidantToken())
                        .param("weekStart", lastWeek.toString()))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), senior)
                        .param("weekStart", lastWeek.toString()))
                .andExpect(status().isForbidden());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), aidant)
                        .param("weekStart", lastWeek.plusDays(1).toString()))
                .andExpect(status().isBadRequest());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), aidant)
                        .param("weekStart", lastWeek.plusWeeks(2).toString()))
                .andExpect(status().isBadRequest());

        // Semaine sans données : PDF valide, avertissement présent.
        MvcResult empty = mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", seniorId), aidant)
                        .param("weekStart", lastWeek.toString()))
                .andExpect(status().isOk()).andReturn();
        assertThat(pdfText(empty.getResponse().getContentAsByteArray()))
                .contains(normalize(WeeklyReport.AVERTISSEMENT), "Aucun rappel programmé");
    }

    private void createMedication() throws Exception {
        mvc.perform(bearer(post("/api/v1/seniors/{id}/medications", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomMedicament", "Metformine 500", "consigne", "1 comprimé pendant le repas",
                                "dateDebut", lastWeek.minusDays(7).toString(),
                                "horaires", List.of(Map.of("heure", "08:00", "jours",
                                        List.of("LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM")))))))
                .andExpect(status().isCreated());
    }

    public static String pdfText(byte[] pdf) throws IOException {
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        PdfReader reader = new PdfReader(pdf);
        PdfTextExtractor extractor = new PdfTextExtractor(reader);
        StringBuilder all = new StringBuilder();
        for (int page = 1; page <= reader.getNumberOfPages(); page++) {
            all.append(extractor.getTextFromPage(page)).append(' ');
        }
        return normalize(all.toString());
    }

    public static String normalize(String text) {
        return text.replaceAll("\\s+", " ").trim();
    }
}
