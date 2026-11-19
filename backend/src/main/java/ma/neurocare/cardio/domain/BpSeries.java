package ma.neurocare.cardio.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;

/** Protocole d'automesure sur 3 jours consécutifs (table {@code bp_series}). */
@Entity
@Table(name = "bp_series")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BpSeries extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    /** Jour 1 du protocole (date locale du téléphone). */
    @Column(name = "date_debut", nullable = false, updatable = false)
    private LocalDate dateDebut;

    @Column(name = "cree_le", nullable = false, updatable = false)
    private Instant creeLe;

    public BpSeries(UUID seniorId, LocalDate dateDebut, Instant creeLe) {
        this.seniorId = seniorId;
        this.dateDebut = dateDebut;
        this.creeLe = creeLe;
    }
}
