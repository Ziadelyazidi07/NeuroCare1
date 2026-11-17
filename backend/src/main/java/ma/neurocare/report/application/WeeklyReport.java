package ma.neurocare.report.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import ma.neurocare.reminder.domain.DoseStatus;

/**
 * Contenu du rapport hebdomadaire (cahier §11.1), agrégé avant rendu. Données descriptives uniquement.
 */
public record WeeklyReport(
        String nomSenior,
        Integer age,
        LocalDate debut,
        LocalDate fin,
        String semaineIso,
        String aidant,
        Instant genereLe,
        ZoneId fuseau,
        boolean donneesFictives,
        List<TreatmentLine> traitements,
        List<DoseLine> prises,
        List<TreatmentTotals> totaux,
        List<ExerciseLine> exercices,
        ExerciseEvolution evolution,
        String observations) {

    /** Avertissement fixe, obligatoire sur chaque rapport (cahier §11.1, point 2). */
    public static final String AVERTISSEMENT = "Document descriptif généré par NeuroCare. Il ne constitue pas un "
            + "diagnostic. Une confirmation dans l'application ne prouve pas la prise effective du médicament.";

    public record TreatmentLine(String nom, String consigne, String horaires, boolean actif) {
    }

    public record DoseLine(LocalDate date, LocalTime heure, String traitement, DoseStatus statut,
                           LocalTime confirmeA) {
    }

    /** @param delaiMedianMinutes délai médian entre l'heure prévue et la confirmation ; nul sans confirmation */
    public record TreatmentTotals(String traitement, int confirmees, int sansReponse, int desactivees, int enAttente,
                                  Long delaiMedianMinutes) {
    }

    public record ExerciseLine(LocalDateTime date, String exercice, int corrects, int presentes, Integer dureeSec,
                               boolean interrompu) {
    }

    /**
     * Évolution brute (sans interprétation) : moyenne des taux de réussite des exercices non interrompus
     * de la semaine et des 4 semaines précédentes. Moyennes nulles s'il n'y a aucun exercice.
     */
    public record ExerciseEvolution(int exercicesSemaine, BigDecimal moyenneSemaine,
                                    int exercicesPrecedents, BigDecimal moyennePrecedente) {
    }
}
