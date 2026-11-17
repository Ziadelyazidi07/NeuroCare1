package ma.neurocare.medication.domain;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Horaire de rappel d'un traitement (table {@code medication_schedules}).
 * L'heure est exprimée dans le fuseau du senior.
 */
@Entity
@Table(name = "medication_schedules")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MedicationSchedule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "medication_id", nullable = false, updatable = false)
    private Medication medication;

    @Column(name = "heure_rappel", nullable = false)
    private LocalTime heureRappel;

    /** Masque binaire : lundi = 1 … dimanche = 64 (voir {@link WeekdayMask}). */
    @Column(name = "jours_semaine", nullable = false)
    private short joursSemaine = WeekdayMask.ALL_DAYS;

    public MedicationSchedule(LocalTime heureRappel, Set<DayOfWeek> jours) {
        this.heureRappel = heureRappel;
        this.joursSemaine = WeekdayMask.of(jours);
    }

    public boolean appliesOn(DayOfWeek day) {
        return WeekdayMask.contains(joursSemaine, day);
    }
}
