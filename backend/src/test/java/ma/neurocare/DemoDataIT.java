package ma.neurocare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;

import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.report.ReportIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Profil {@code demo} : délais réduits (cahier §9.6) et données fictives V99 chargées (scénario §2.2).
 */
@ActiveProfiles({"test", "demo"})
class DemoDataIT extends AbstractIntegrationTest {

    private static final String SENIOR_ID = "0d000000-0000-4000-8000-000000000002";
    private static final String DEMO_DEVICE_TOKEN = "ncd_demo-hajj-ahmed-NE-PAS-UTILISER-EN-PRODUCTION";

    @Autowired
    NeuroCareProperties properties;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void demoProfileShortensDelays() {
        assertThat(properties.reminder().tick()).isEqualTo(Duration.ofSeconds(10));
        assertThat(properties.reminder().relanceAfter()).isEqualTo(Duration.ofSeconds(30));
        assertThat(properties.reminder().timeoutOverride()).isEqualTo(Duration.ofMinutes(1));
        assertThat(properties.reminder().effectiveTimeout(30)).isEqualTo(Duration.ofMinutes(1));
    }

    @Test
    void demoDataIsLoadedAndMarkedFictive() throws Exception {
        assertThat(jdbc.queryForObject("SELECT donnees_fictives FROM senior_profiles WHERE user_id = ?::uuid",
                Boolean.class, SENIOR_ID)).isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM dose_events WHERE senior_id = ?::uuid", Integer.class,
                SENIOR_ID)).isGreaterThanOrEqualTo(28);
        assertThat(jdbc.queryForObject("SELECT count(DISTINCT statut) FROM dose_events WHERE senior_id = ?::uuid",
                Integer.class, SENIOR_ID)).isEqualTo(3); // CONFIRME, SANS_REPONSE, DESACTIVE

        // Salma se connecte avec les identifiants de démo.
        MvcResult login = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("telephone", "+212600000001", "motDePasse", "NeuroCare-Demo-2026"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.nomComplet").value("Salma B."))
                .andReturn();
        String salma = read(login, "$.accessToken");

        mvc.perform(bearer(get("/api/v1/seniors"), salma))
                .andExpect(jsonPath("$[0].id").value(SENIOR_ID))
                .andExpect(jsonPath("$[0].nomComplet").value("Hajj Ahmed"))
                .andExpect(jsonPath("$[0].anneeNaissance").value(1952))
                .andExpect(jsonPath("$[0].donneesFictives").value(true))
                .andExpect(jsonPath("$[0].lien.surnomSenior").value("Baba"))
                .andExpect(jsonPath("$[0].lien.consentementValide").value(true));
        mvc.perform(bearer(get("/api/v1/seniors/{id}/medications", SENIOR_ID), salma))
                .andExpect(jsonPath("$[*].nomMedicament").value(org.hamcrest.Matchers.hasItems(
                        "Metformine 500", "Vitamine D", "Amlodipine 5")));
        mvc.perform(bearer(get("/api/v1/seniors/{id}/dashboard/history", SENIOR_ID), salma).param("days", "14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tauxConfirmationPeriode").isNumber())
                .andExpect(jsonPath("$.exercices.length()").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

        // Rapport de la semaine précédente : données fictives signalées.
        LocalDate lastWeek = LocalDate.now(ZoneId.of("Africa/Casablanca"))
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
        MvcResult pdf = mvc.perform(bearer(get("/api/v1/seniors/{id}/reports/weekly", SENIOR_ID), salma)
                        .param("weekStart", lastWeek.toString()))
                .andExpect(status().isOk()).andReturn();
        assertThat(ReportIT.pdfText(pdf.getResponse().getContentAsByteArray()))
                .contains("DONNÉES FICTIVES", "Hajj Ahmed", "ans", "Metformine 500", "Confirmé");

        // Le téléphone de démo est déjà appairé.
        mvc.perform(bearer(get("/api/v1/me/doses/today"), DEMO_DEVICE_TOKEN)).andExpect(status().isOk());
        mvc.perform(bearer(get("/api/v1/me/cognitive/next"), DEMO_DEVICE_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.langue").value("DARIJA"));
    }
}
