package ma.neurocare.medication.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Traitement saisi par un aidant à partir d'une prescription existante (table {@code medications}).
 * Aucun champ de posologie calculée (EF-ME-03) : la consigne est un texte libre validé.
 */
@Entity
@Table(name = "medications")
@Getter
@Setter
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

    @OneToMany(mappedBy = "medication", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MedicationSchedule> horaires = new ArrayList<>();

    public Medication(UUID seniorId, String nomMedicament, String consigne,
                      LocalDate dateDebut, LocalDate dateFin, UUID creePar) {
        this.seniorId = seniorId;
        this.nomMedicament = nomMedicament;
        this.consigne = consigne;
        this.dateDebut = dateDebut;
        this.dateFin = dateFin;
        this.creePar = creePar;
    }

    public void addHoraire(MedicationSchedule schedule) {
        schedule.setMedication(this);
        horaires.add(schedule);
    }
}
