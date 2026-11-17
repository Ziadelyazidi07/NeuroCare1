package ma.neurocare;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base des tests d'intégration : contexte complet sur PostgreSQL 16 (Testcontainers), partagé
 * entre les classes. Chaque test crée ses propres comptes (téléphones aléatoires) pour rester isolé.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
public abstract class AbstractIntegrationTest {

    protected static final String PASSWORD = "MotDePasse!2026";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    protected static String randomPhone() {
        return "+2126" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999);
    }

    protected static String randomIp() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        return "10." + r.nextInt(256) + "." + r.nextInt(256) + "." + r.nextInt(1, 255);
    }

    protected String toJson(Object body) throws Exception {
        return json.writeValueAsString(body);
    }

    protected static <T> T read(MvcResult result, String path) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), path);
    }

    protected static MockHttpServletRequestBuilder bearer(MockHttpServletRequestBuilder request, String token) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    /** Inscrit un aidant et renvoie la réponse de connexion. */
    protected MvcResult registerAndLogin(String phone) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomComplet", "Salma B.", "telephone", phone, "motDePasse", PASSWORD))))
                .andExpect(status().isCreated());
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("telephone", phone, "motDePasse", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
    }

    protected String newAidantToken() throws Exception {
        return read(registerAndLogin(randomPhone()), "$.accessToken");
    }

    /** Crée un senior pour l'aidant et renvoie son identifiant. */
    protected String createSenior(String aidantToken) throws Exception {
        MvcResult result = mvc.perform(bearer(post("/api/v1/seniors"), aidantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomComplet", "Hajj Ahmed", "lienParente", "fille",
                                "surnomSenior", "Baba", "donneesFictives", true))))
                .andExpect(status().isCreated())
                .andReturn();
        return read(result, "$.id");
    }
}
