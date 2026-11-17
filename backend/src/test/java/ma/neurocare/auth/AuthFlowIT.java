package ma.neurocare.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import ma.neurocare.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** EF-AU-01, 02, 06, 07 et rotation des refresh tokens (cahier §8.1). */
class AuthFlowIT extends AbstractIntegrationTest {

    @Test
    void registerThenLoginReturnsTokensAndUser() throws Exception {
        String phone = randomPhone();
        MvcResult login = registerAndLogin(phone);

        assertThat((String) read(login, "$.accessToken")).isNotBlank();
        assertThat((String) read(login, "$.refreshToken")).isNotBlank();
        assertThat((Integer) read(login, "$.expiresIn")).isEqualTo(900);
        assertThat((String) read(login, "$.user.role")).isEqualTo("AIDANT");

        String access = read(login, "$.accessToken");
        mvc.perform(bearer(get("/api/v1/seniors"), access)).andExpect(status().isOk());
    }

    @Test
    void duplicatePhoneIsRejectedWith409() throws Exception {
        String phone = randomPhone();
        registerAndLogin(phone);

        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomComplet", "Autre", "telephone", phone, "motDePasse", PASSWORD))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PHONE_ALREADY_USED"));
    }

    @Test
    void registerValidatesPhoneAndPassword() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("nomComplet", "X", "telephone", "0612345678", "motDePasse", "court"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.errors.length()").value(2));
    }

    @Test
    void wrongPasswordIs401AndAccountLocksAfterFiveFailures() throws Exception {
        String phone = randomPhone();
        registerAndLogin(phone);

        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(toJson(Map.of("telephone", phone, "motDePasse", "mauvais-mdp"))))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }
        // Même avec le bon mot de passe, le compte reste bloqué 15 min.
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("telephone", phone, "motDePasse", PASSWORD))))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void unknownPhoneGivesSameErrorAsWrongPassword() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("telephone", randomPhone(), "motDePasse", PASSWORD))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void refreshRotatesAndReuseRevokesWholeFamily() throws Exception {
        String first = read(registerAndLogin(randomPhone()), "$.refreshToken");

        String second = read(refresh(first, 200), "$.refreshToken");
        assertThat(second).isNotEqualTo(first);

        // Réutilisation de l'ancien token : vol présumé → famille révoquée.
        refresh(first, 401);
        // Le token légitime le plus récent est donc lui aussi révoqué.
        refresh(second, 401);
    }

    @Test
    void logoutRevokesRefreshTokenAndRequiresAuthentication() throws Exception {
        MvcResult login = registerAndLogin(randomPhone());
        String access = read(login, "$.accessToken");
        String refreshToken = read(login, "$.refreshToken");

        mvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isUnauthorized());

        mvc.perform(bearer(post("/api/v1/auth/logout"), access).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isNoContent());

        refresh(refreshToken, 401);
    }

    @Test
    void tamperedJwtIsRejected() throws Exception {
        String access = newAidantToken();
        mvc.perform(bearer(get("/api/v1/seniors"), access + "x"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    private MvcResult refresh(String refreshToken, int expectedStatus) throws Exception {
        return mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("refreshToken", refreshToken))))
                .andExpect(status().is(expectedStatus))
                .andReturn();
    }
}
