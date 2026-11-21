package ma.neurocare.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ma.neurocare.assistant.domain.KnowledgeBaseValidator;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;

class KnowledgeBaseValidatorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode base() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/knowledge/knowledge-base.json")) {
            return mapper.readTree(in);
        }
    }

    @Test
    void laBaseLivreeEstValide() throws Exception {
        assertThat(KnowledgeBaseValidator.validate(base())).isEmpty();
    }

    @Test
    void refuseUneSourceNonReconnue() throws Exception {
        JsonNode kb = base();
        ((ArrayNode) kb.path("topics").get(0).path("source").path("orgs")).removeAll().add("Blog santé");
        assertThat(KnowledgeBaseValidator.validate(kb)).anyMatch(e -> e.contains("source non reconnue"));
    }

    @Test
    void exigeLAppelDes15Et141PourUneFicheUrgente() throws Exception {
        JsonNode kb = base();
        ((ArrayNode) kb.path("topics").get(0).path("actions")).removeAll();
        assertThat(KnowledgeBaseValidator.validate(kb)).anyMatch(e -> e.contains("sans appel du 15 et du 141"));
    }

    @Test
    void exigeLaReponseEnArabe() throws Exception {
        JsonNode kb = base();
        ((ObjectNode) kb.path("topics").get(1).path("answer")).put("ar", "");
        assertThat(KnowledgeBaseValidator.validate(kb)).anyMatch(e -> e.contains("réponse ar manquante"));
    }

    @Test
    void lesReponsesNePosentJamaisDeDiagnostic() throws Exception {
        for (JsonNode topic : base().path("topics")) {
            assertThat(topic.path("answer").path("fr").asText()).doesNotContainIgnoringCase("vous avez un").doesNotContainIgnoringCase("vous êtes atteint");
        }
    }
}
