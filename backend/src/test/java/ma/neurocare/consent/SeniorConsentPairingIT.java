package ma.neurocare.consent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import ma.neurocare.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** Seniors, consentements (EF-CO-01 à 04), appairage et appareils (EF-AU-03 à 05). */
class SeniorConsentPairingIT extends AbstractIntegrationTest {

    // ---------- Seniors ----------

    @Test
    void aidantCreatesSeniorWithDefaultsAndInactiveLink() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);

        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.langue").value("DARIJA"))
                .andExpect(jsonPath("$.taillePolice").value(24))
                .andExpect(jsonPath("$.delaiSansReponseMin").value(30))
                .andExpect(jsonPath("$.donneesFictives").value(true))
                .andExpect(jsonPath("$.lien.surnomSenior").value("Baba"))
                .andExpect(jsonPath("$.lien.consentementValide").value(false));

        mvc.perform(bearer(get("/api/v1/seniors"), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(seniorId));
    }

    @Test
    void unlinkedAidantGets404NotForbidden() throws Exception {
        String seniorId = createSenior(newAidantToken());
        String stranger = newAidantToken();

        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), stranger))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        mvc.perform(bearer(get("/api/v1/seniors/{id}/consents", seniorId), stranger))
                .andExpect(status().isNotFound());
        mvc.perform(bearer(post("/api/v1/seniors/{id}/pairing-codes", seniorId), stranger))
                .andExpect(status().isNotFound());
    }

    @Test
    void patchUpdatesPreferencesAndValidatesInput() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);

        mvc.perform(bearer(patch("/api/v1/seniors/{id}", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("langue", "FR", "taillePolice", 32,
                                "contactUrgenceTel", "+212600000001"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.langue").value("FR"))
                .andExpect(jsonPath("$.taillePolice").value(32))
                .andExpect(jsonPath("$.contrasteEleve").value(true));

        mvc.perform(bearer(patch("/api/v1/seniors/{id}", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("contactUrgenceTel", "0600"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("contactUrgenceTel"));
    }

    // ---------- Consentements ----------

    @Test
    void consentsStartUngrantedAndAidantNeedsSeniorPresence() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);

        mvc.perform(bearer(get("/api/v1/seniors/{id}/consents", seniorId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[?(@.accorde == true)]").isEmpty());

        mvc.perform(bearer(put("/api/v1/seniors/{id}/consents/RAPPELS", seniorId), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("accorde", true, "versionTexte", "v1"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void familySharingActivatesThenRevocationDeactivatesTheLink() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);

        setConsent(aidant, seniorId, "PARTAGE_FAMILIAL", true);
        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), aidant))
                .andExpect(jsonPath("$.lien.consentementValide").value(true));

        setConsent(aidant, seniorId, "PARTAGE_FAMILIAL", false);
        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), aidant))
                .andExpect(jsonPath("$.lien.consentementValide").value(false));

        MvcResult history = mvc.perform(bearer(get("/api/v1/seniors/{id}/consents/history", seniorId), aidant))
                .andExpect(status().isOk())
                .andReturn();
        List<Boolean> values = read(history, "$[*].accorde");
        assertThat(values).containsExactly(false, true);
        assertThat((List<String>) read(history, "$[*].canal")).containsOnly("APP_AIDANT");
        assertThat((List<String>) read(history, "$[*].versionTexte")).containsOnly("v1");
    }

    @Test
    void consentsAreIndependent() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);

        setConsent(aidant, seniorId, "RAPPELS", true);
        setConsent(aidant, seniorId, "VOIX", false);

        mvc.perform(bearer(get("/api/v1/seniors/{id}/consents", seniorId), aidant))
                .andExpect(jsonPath("$[?(@.type == 'RAPPELS')].accorde").value(true))
                .andExpect(jsonPath("$[?(@.type == 'VOIX')].accorde").value(false))
                .andExpect(jsonPath("$[?(@.type == 'EXERCICES')].accorde").value(false));
    }

    // ---------- Appairage et appareils ----------

    @Test
    void pairingGivesSeniorDeviceTokenScopedToHimself() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);
        String otherSeniorId = createSenior(aidant);

        String deviceToken = pair(aidant, seniorId);
        assertThat(deviceToken).startsWith("ncd_");

        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), deviceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lien").doesNotExist());
        mvc.perform(bearer(get("/api/v1/seniors/{id}", otherSeniorId), deviceToken))
                .andExpect(status().isNotFound());
        // Un senior n'a pas accès aux routes réservées aux aidants.
        mvc.perform(bearer(get("/api/v1/seniors"), deviceToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // Le senior exprime lui-même un consentement : canal APP_SENIOR, sans confirmation de présence.
        mvc.perform(bearer(put("/api/v1/seniors/{id}/consents/EXERCICES", seniorId), deviceToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("accorde", true, "versionTexte", "v1"))))
                .andExpect(status().isOk());
        mvc.perform(bearer(get("/api/v1/seniors/{id}/consents/history", seniorId), deviceToken))
                .andExpect(jsonPath("$[0].canal").value("APP_SENIOR"));
    }

    @Test
    void meRoutesAreSeniorOnlyExceptDevices() throws Exception {
        String aidant = newAidantToken();
        mvc.perform(bearer(get("/api/v1/me/doses/today"), aidant))
                .andExpect(status().isForbidden());

        String deviceToken = pair(aidant, createSenior(aidant));
        mvc.perform(bearer(get("/api/v1/me/doses/today"), deviceToken))
                .andExpect(status().isOk());
    }

    @Test
    void pairingCodeIsSingleUseAndNewCodeInvalidatesPrevious() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);

        String code = generateCode(aidant, seniorId);
        redeem(code, randomIp()).andExpect(status().isOk());
        redeem(code, randomIp())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAIRING_CODE_INVALID"));

        String stale = generateCode(aidant, seniorId);
        String fresh = generateCode(aidant, seniorId);
        if (!stale.equals(fresh)) {
            redeem(stale, randomIp()).andExpect(status().isBadRequest());
        }
        redeem(fresh, randomIp()).andExpect(status().isOk());
    }

    @Test
    void pairingIsRateLimitedPerIp() throws Exception {
        String ip = randomIp();
        for (int i = 0; i < 5; i++) {
            redeem("000000", ip).andExpect(status().isBadRequest());
        }
        redeem("000000", ip)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void revokedDeviceTokenIsRejected() throws Exception {
        String aidant = newAidantToken();
        String seniorId = createSenior(aidant);
        String deviceToken = pair(aidant, seniorId);

        MvcResult devices = mvc.perform(bearer(get("/api/v1/seniors/{id}/devices", seniorId), aidant))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andReturn();
        String deviceId = read(devices, "$[0].id");

        mvc.perform(bearer(delete("/api/v1/seniors/{id}/devices/{deviceId}", seniorId, deviceId), aidant))
                .andExpect(status().isNoContent());
        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), deviceToken))
                .andExpect(status().isUnauthorized());
    }

    // ---------- Lien ----------

    @Test
    void aidantCanBreakOwnLinkThenLosesAccess() throws Exception {
        MvcResult login = registerAndLogin(randomPhone());
        String aidant = read(login, "$.accessToken");
        String aidantId = read(login, "$.user.id");
        String seniorId = createSenior(aidant);

        mvc.perform(bearer(delete("/api/v1/seniors/{id}/caregivers/{aidantId}", seniorId, aidantId), aidant))
                .andExpect(status().isNoContent());
        mvc.perform(bearer(get("/api/v1/seniors/{id}", seniorId), aidant))
                .andExpect(status().isNotFound());
    }

    // ---------- Helpers ----------

    private void setConsent(String aidant, String seniorId, String type, boolean accorde) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("accorde", accorde);
        body.put("versionTexte", "v1");
        body.put("presenceSeniorConfirmee", true);
        mvc.perform(bearer(put("/api/v1/seniors/{id}/consents/{type}", seniorId, type), aidant)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accorde").value(accorde));
    }

    private String generateCode(String aidant, String seniorId) throws Exception {
        MvcResult result = mvc.perform(bearer(post("/api/v1/seniors/{id}/pairing-codes", seniorId), aidant))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.matchesPattern("\\d{6}")))
                .andReturn();
        return read(result, "$.code");
    }

    private org.springframework.test.web.servlet.ResultActions redeem(String code, String ip) throws Exception {
        return mvc.perform(post("/api/v1/auth/pairing/redeem")
                .with(request -> {
                    request.setRemoteAddr(ip);
                    return request;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("code", code, "plateforme", "ANDROID"))));
    }

    private String pair(String aidant, String seniorId) throws Exception {
        MvcResult result = redeem(generateCode(aidant, seniorId), randomIp())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seniorId").value(seniorId))
                .andReturn();
        return read(result, "$.deviceToken");
    }
}
