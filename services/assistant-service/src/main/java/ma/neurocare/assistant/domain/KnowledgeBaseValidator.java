package ma.neurocare.assistant.domain;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Règles de qualité de la base de connaissances, vérifiées au démarrage (le service refuse de démarrer
 * avec une base invalide) : version, avertissement éthique FR / AR, chaque fiche traduite, sourcée par un
 * organisme reconnu (OMS, HAS, ESC, FID), et toute fiche urgente propose l'appel du 15 et du 141.
 */
public final class KnowledgeBaseValidator {

    public static final Set<String> ALLOWED_SOURCES = Set.of("OMS", "HAS", "ESC", "FID");
    public static final Set<String> MODULES = Set.of("observance", "saturation", "mental", "metabolic", "cardio", "alzheimer");
    private static final List<String> LANGUAGES = List.of("fr", "ar");
    /** Résumé affiché sur l'écran unique (sans défilement) de l'application : texte court obligatoire. */
    public static final int MAX_SUMMARY_LENGTH = 220;
    /** Titre sur deux lignes au plus. */
    public static final int MAX_TITLE_LENGTH = 45;

    private KnowledgeBaseValidator() {
    }

    /** Liste des anomalies (vide si la base est valide). */
    public static List<String> validate(JsonNode kb) {
        List<String> errors = new ArrayList<>();
        if (!kb.path("version").isTextual() || kb.path("version").asText().isBlank()) errors.add("version manquante");
        for (String field : List.of("disclaimer", "fallback")) {
            for (String lang : LANGUAGES) {
                if (kb.path(field).path(lang).asText().isBlank()) errors.add(field + "." + lang + " manquant");
            }
        }
        for (String org : ALLOWED_SOURCES) {
            if (!kb.path("sources").has(org)) errors.add("source " + org + " non décrite");
        }
        JsonNode topics = kb.path("topics");
        if (!topics.isArray() || topics.isEmpty()) {
            errors.add("aucune fiche");
            return errors;
        }
        Set<String> ids = new HashSet<>();
        for (JsonNode topic : topics) {
            String id = topic.path("id").asText();
            if (id.isBlank() || !ids.add(id)) errors.add("identifiant absent ou en double : '" + id + "'");
            for (String lang : LANGUAGES) {
                String title = topic.path("title").path(lang).asText();
                if (title.isBlank()) errors.add(id + " : titre " + lang + " manquant");
                if (title.length() > MAX_TITLE_LENGTH) errors.add(id + " : titre " + lang + " trop long");
                if (topic.path("answer").path(lang).asText().isBlank()) errors.add(id + " : réponse " + lang + " manquante");
                String summary = topic.path("summary").path(lang).asText();
                if (summary.isBlank()) errors.add(id + " : résumé " + lang + " manquant");
                if (summary.length() > MAX_SUMMARY_LENGTH) errors.add(id + " : résumé " + lang + " trop long (" + summary.length() + " > " + MAX_SUMMARY_LENGTH + ")");
                if (topic.path("source").path("reference").path(lang).asText().isBlank()) errors.add(id + " : référence " + lang + " manquante");
            }
            JsonNode orgs = topic.path("source").path("orgs");
            if (!orgs.isArray() || orgs.isEmpty()) errors.add(id + " : aucune source");
            for (JsonNode org : orgs) {
                if (!ALLOWED_SOURCES.contains(org.asText())) errors.add(id + " : source non reconnue " + org.asText());
            }
            for (String group : List.of("fr", "ar", "darija")) {
                if (topic.path("keywords").path(group).isEmpty()) errors.add(id + " : mots-clés " + group + " manquants");
            }
            Set<String> calls = new HashSet<>();
            for (JsonNode action : topic.path("actions")) {
                switch (action.path("type").asText()) {
                    case "call" -> calls.add(action.path("number").asText());
                    case "module" -> {
                        if (!MODULES.contains(action.path("module").asText())) errors.add(id + " : module inconnu " + action.path("module").asText());
                    }
                    default -> errors.add(id + " : action inconnue " + action.path("type").asText());
                }
            }
            if (topic.path("urgent").asBoolean() && !calls.containsAll(Set.of("15", "141"))) errors.add(id + " : fiche urgente sans appel du 15 et du 141");
        }
        return errors;
    }
}
