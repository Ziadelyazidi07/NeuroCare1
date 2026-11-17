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

    /** Appaire un téléphone au senior et renvoie le token d'appareil. */
    protected String pairDevice(String aidantToken, String seniorId) throws Exception {
        MvcResult code = mvc.perform(bearer(post("/api/v1/seniors/{id}/pairing-codes", seniorId), aidantToken))
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

    /** Enregistre un consentement par l'aidant, en présence du senior. */
    protected void giveConsent(String aidantToken, String seniorId, String type, boolean accorde) throws Exception {
        mvc.perform(bearer(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .put("/api/v1/seniors/{id}/consents/{type}", seniorId, type), aidantToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("accorde", accorde, "versionTexte", "v1",
                                "presenceSeniorConfirmee", true))))
                .andExpect(status().isOk());
    }

    /** Attend qu'une condition asynchrone devienne vraie (génération audio, enrôlement vocal…). */
    protected static void awaitUntil(String what, java.util.concurrent.Callable<Boolean> condition) throws Exception {
        long deadline = System.nanoTime() + java.time.Duration.ofSeconds(15).toNanos();
        while (System.nanoTime() < deadline) {
            if (Boolean.TRUE.equals(condition.call())) {
                return;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Délai dépassé en attendant : " + what);
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
