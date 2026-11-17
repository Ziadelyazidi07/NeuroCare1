package ma.neurocare.dashboard.api.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import ma.neurocare.cognitive.domain.ExerciseType;
import ma.neurocare.reminder.domain.DoseStatus;

/**
 * DTO du tableau de bord aidant (cahier §7.7, EF-DA-01 à 03). Descriptif uniquement : aucun score,
 * aucune interprétation ; SANS_REPONSE n'est jamais présenté comme un oubli (§13.3).
 */
public final class DashboardDtos {

    public static final String AVERTISSEMENT = "Données descriptives. « C'est fait » indique que le rappel a été "
            + "confirmé, pas que le médicament a été pris. NeuroCare ne pose aucun diagnostic.";

    private DashboardDtos() {
    }

    /** Une prise et sa pastille : VERT (CONFIRME), ORANGE (SANS_REPONSE), GRIS (EN_ATTENTE / DESACTIVE). */
    public record PriseDto(
            UUID doseId,
            UUID medicationId,
            String nomMedicament,
            String consigne,
            Instant datePrevue,
            DoseStatus statut,
            String couleur,
            Instant horodatageAction) {
    }

    public record ResumeDto(int total, int confirmees, int sansReponse, int enAttente, int desactivees) {
    }

    /** Dernier exercice : valeurs brutes uniquement. */
    public record DernierExerciceDto(
            UUID sessionId,
            Instant dateExercice,
            ExerciseType typeExercice,
            int motsPresentes,
            int corrects,
            boolean interrompu) {
    }

    public record TodayDto(
            UUID seniorId,
            LocalDate date,
            List<PriseDto> prises,
            ResumeDto resume,
            DernierExerciceDto dernierExercice,
            String avertissement) {
    }

    /**
     * @param tauxConfirmation part des prises confirmées parmi les prises clôturées (confirmées + sans réponse),
     *                         en % ; nul si aucune prise clôturée ce jour-là
     */
    public record JourDto(
            LocalDate date,
            int confirmees,
            int sansReponse,
            int enAttente,
            int desactivees,
            BigDecimal tauxConfirmation) {
    }

    /** Point de la courbe descriptive des exercices (EF-CG-04) ; taux nul pour un exercice interrompu. */
    public record PointExerciceDto(Instant dateExercice, int motsPresentes, int corrects, BigDecimal tauxReussite,
                                   boolean interrompu) {
    }

    public record HistoryDto(
            UUID seniorId,
            LocalDate du,
            LocalDate au,
            List<JourDto> jours,
            BigDecimal tauxConfirmationPeriode,
            List<PointExerciceDto> exercices,
            String avertissement) {
    }
}
