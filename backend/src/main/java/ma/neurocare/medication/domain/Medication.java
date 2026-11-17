package ma.neurocare.medication.domain;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Traitement saisi par un aidant à partir d'une prescription existante (table {@code medications}).
 * Aucun champ de posologie calculée (EF-ME-03) : la consigne est un texte libre validé.
 */
@Entity
@Table(name = "medications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Medication extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "nom_medicament", nullable = false, length = 120)
    private String nomMedicament;

    @Column(name = "consigne", length = 255)
    private String consigne;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    /** Désactivation logique : l'historique est conservé (EF-ME-02). */
    @Column(name = "actif", nullable = false)
    private boolean actif = true;

    @Column(name = "cree_par", nullable = false, updatable = false)
    private UUID creePar;

    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation = Instant.now();

    @OneToMany(mappedBy = "medication", cascade = CascadeType.ALL)
    @OrderBy("heureRappel ASC")
    private List<MedicationSchedule> horaires = new ArrayList<>();

    public Medication(UUID seniorId, String nomMedicament, String consigne,
                      LocalDate dateDebut, LocalDate dateFin, UUID creePar) {
        this.seniorId = seniorId;
        this.creePar = creePar;
        describe(nomMedicament, consigne, dateDebut, dateFin);
    }

    public void describe(String nomMedicament, String consigne, LocalDate dateDebut, LocalDate dateFin) {
        if (dateFin != null && dateFin.isBefore(dateDebut)) {
            throw new IllegalArgumentException("La date de fin précède la date de début");
        }
        this.nomMedicament = nomMedicament;
        this.consigne = consigne;
        this.dateDebut = dateDebut;
        this.dateFin = dateFin;
    }

    /**
     * Remplace les horaires : un horaire de même heure est conservé (jours mis à jour), une nouvelle
     * heure crée un horaire, une heure retirée désactive l'horaire (l'historique des prises reste lié).
     */
    public void replaceSchedules(Map<LocalTime, Set<DayOfWeek>> wanted) {
        for (MedicationSchedule existing : horaires) {
            Set<DayOfWeek> days = wanted.get(existing.getHeureRappel());
            if (days == null) {
                existing.setActif(false);
            } else {
                existing.changeDays(days);
                existing.setActif(true);
            }
        }
        wanted.forEach((heure, days) -> {
            if (findSchedule(heure).isEmpty()) {
                MedicationSchedule schedule = new MedicationSchedule(heure, days);
                schedule.setMedication(this);
                horaires.add(schedule);
            }
        });
    }

    public void deactivate() {
        this.actif = false;
    }

    public List<MedicationSchedule> activeSchedules() {
        return horaires.stream().filter(MedicationSchedule::isActif).toList();
    }

    private Optional<MedicationSchedule> findSchedule(LocalTime heure) {
        return horaires.stream().filter(s -> s.getHeureRappel().equals(heure)).findFirst();
    }
}
