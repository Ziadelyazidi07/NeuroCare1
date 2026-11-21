package ma.neurocare.assistant.api;

import com.fasterxml.jackson.databind.JsonNode;
import ma.neurocare.assistant.application.KnowledgeBaseService;
import ma.neurocare.assistant.domain.KnowledgeBaseValidator;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;
import java.util.TreeSet;

/** API publique, en lecture seule : santé du service et base de connaissances (ETag = version). */
@RestController
@RequestMapping("/api/v1/assistant")
public class AssistantController {

    private final KnowledgeBaseService service;

    public AssistantController(KnowledgeBaseService service) {
        this.service = service;
    }

    public record HealthResponse(String status, String service, String knowledgeVersion, int topics, List<String> sources) {
    }

    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("UP", "assistant-service", service.version(), service.topicCount(),
                List.copyOf(new TreeSet<>(KnowledgeBaseValidator.ALLOWED_SOURCES)));
    }

    /** Base complète ; 304 si le téléphone a déjà cette version (en-tête If-None-Match). */
    @GetMapping("/knowledge")
    public ResponseEntity<JsonNode> knowledge(@RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        String etag = "\"" + service.version() + "\"";
        if (etag.equals(ifNoneMatch)) return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        return ResponseEntity.ok().eTag(etag).cacheControl(CacheControl.maxAge(Duration.ofHours(1))).body(service.knowledgeBase());
    }
}
