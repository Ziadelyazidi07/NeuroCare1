package ma.neurocare.cognitive.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Résultat brut d'un rappel de mots (EF-CG-02, cahier §6.4) : uniquement des données d'exécution.
 * Aucune étiquette, aucun seuil, aucune interprétation clinique (§13.3).
 */
public final class WordRecallResult {

    private final List<String> motsPresentes;
    private final List<String> propositions;
    private final List<String> motsChoisis;
    private final int delaiRappelSec;
    private final List<Integer> tempsReponseMs;
    private final boolean interrompu;

    public WordRecallResult(List<String> motsPresentes, List<String> propositions, List<String> motsChoisis,
                            int delaiRappelSec, List<Integer> tempsReponseMs, boolean interrompu) {
        validate(motsPresentes, propositions, motsChoisis, delaiRappelSec, tempsReponseMs);
        this.motsPresentes = List.copyOf(motsPresentes);
        this.propositions = List.copyOf(propositions);
        this.motsChoisis = List.copyOf(motsChoisis);
        this.delaiRappelSec = delaiRappelSec;
        this.tempsReponseMs = tempsReponseMs == null ? List.of() : List.copyOf(tempsReponseMs);
        this.interrompu = interrompu;
    }

    /** Nombre de mots choisis qui faisaient partie des mots présentés. */
    public int corrects() {
        Set<String> presented = new HashSet<>(motsPresentes);
        return (int) motsChoisis.stream().filter(presented::contains).count();
    }

    /**
     * Taux de réussite brut (0–100). Nul si l'exercice a été interrompu : l'interruption est permise
     * sans pénalité (EF-CG-03) et n'est donc pas comptée comme un résultat.
     */
    public BigDecimal tauxReussite() {
        if (interrompu) {
            return null;
        }
        return BigDecimal.valueOf(corrects() * 100L)
                .divide(BigDecimal.valueOf(motsPresentes.size()), 2, RoundingMode.HALF_UP);
    }

    public int motsPresentesCount() {
        return motsPresentes.size();
    }

    public List<String> motsPresentes() {
        return motsPresentes;
    }

    /** Document JSONB stocké tel quel (clés du cahier §6.4). */
    public Map<String, Object> toRawJson() {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("mots_presentes", motsPresentes);
        raw.put("propositions", propositions);
        raw.put("mots_choisis", motsChoisis);
        raw.put("corrects", corrects());
        raw.put("delai_rappel_sec", delaiRappelSec);
        raw.put("temps_reponse_ms", tempsReponseMs);
        return raw;
    }

    private static void validate(List<String> presentes, List<String> propositions, List<String> choisis,
                                 int delai, List<Integer> temps) {
        require(presentes != null && presentes.size() >= WordBank.MIN_WORDS && presentes.size() <= WordBank.MAX_WORDS,
                "Entre 3 et 5 mots présentés");
        require(propositions != null && propositions.size() == WordBank.PROPOSITIONS, "9 propositions attendues");
        require(new HashSet<>(presentes).size() == presentes.size(), "Mots présentés en double");
        require(new HashSet<>(propositions).size() == propositions.size(), "Propositions en double");
        require(propositions.containsAll(presentes), "Les mots présentés doivent figurer parmi les propositions");
        require(choisis != null && choisis.size() <= presentes.size(), "Trop de mots choisis");
        require(new HashSet<>(choisis).size() == choisis.size(), "Mots choisis en double");
        require(propositions.containsAll(choisis), "Les mots choisis doivent figurer parmi les propositions");
        require(delai >= 0 && delai <= 600, "Délai de rappel invalide");
        require(temps == null || (temps.size() <= WordBank.PROPOSITIONS && temps.stream().allMatch(t -> t != null && t >= 0)),
                "Temps de réponse invalides");
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }
}
