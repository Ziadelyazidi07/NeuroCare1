package ma.neurocare.assistant.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ma.neurocare.assistant.domain.KnowledgeBaseValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;

/** Charge la base de connaissances au démarrage et la valide ; le service ne démarre pas si elle est invalide. */
@Service
public class KnowledgeBaseService {

    private final JsonNode knowledgeBase;

    public KnowledgeBaseService(ObjectMapper mapper, @Value("${neurocare.assistant.knowledge:classpath:knowledge/knowledge-base.json}") Resource resource) {
        try (InputStream in = resource.getInputStream()) {
            this.knowledgeBase = mapper.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Base de connaissances illisible : " + resource, e);
        }
        List<String> errors = KnowledgeBaseValidator.validate(knowledgeBase);
        if (!errors.isEmpty()) throw new IllegalStateException("Base de connaissances invalide : " + String.join(" ; ", errors));
    }

    public JsonNode knowledgeBase() {
        return knowledgeBase;
    }

    public String version() {
        return knowledgeBase.path("version").asText();
    }

    public int topicCount() {
        return knowledgeBase.path("topics").size();
    }
}
