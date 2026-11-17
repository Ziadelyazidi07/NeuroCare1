package ma.neurocare;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Livrable de l'étape 1 : le contexte démarre sur PostgreSQL 16, Flyway crée le schéma V1,
 * Hibernate le valide ({@code ddl-auto: validate}), Swagger et health sont accessibles.
 */
class SchemaAndBootstrapIT extends AbstractIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void flywayCreatesAllTables() {
        List<String> tables = jdbc.queryForList("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """, String.class);

        assertThat(tables).contains(
                "users", "senior_profiles", "caregiver_links", "consents", "consent_history",
                "refresh_tokens", "pairing_codes", "devices", "medications", "medication_schedules",
                "dose_events", "voice_profiles", "audio_assets", "cognitive_sessions", "audit_logs",
                "shedlock");
    }

    @Test
    void postgresEnumTypesExist() {
        List<String> types = jdbc.queryForList(
                "SELECT typname FROM pg_type WHERE typtype = 'e'", String.class);

        assertThat(types).contains("user_role", "consent_type", "dose_status", "audio_source");
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void openApiIsPublic() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("NeuroCare API"));
    }

    @Test
    void protectedRouteReturnsRfc7807Unauthorized() throws Exception {
        mvc.perform(get("/api/v1/seniors"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.type").value("https://neurocare.ma/errors/unauthenticated"))
                .andExpect(jsonPath("$.instance").value("/api/v1/seniors"));
    }
}
