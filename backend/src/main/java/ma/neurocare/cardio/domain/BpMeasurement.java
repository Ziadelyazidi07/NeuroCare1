package ma.neurocare.cardio.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;

/**
 * Mesure de tension (table {@code bp_measurements}), classée à l'enregistrement. Ponctuelle, ou rattachée
 * à un créneau du protocole (série, jour 1-3, matin / soir, rang 1-3).
 */
@Entity
@Table(name = "bp_measurements")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BpMeasurement extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "date_mesure", nullable = false, updatable = false)
    private Instant dateMesure;

    @Column(name = "tas", nullable = false, updatable = false)
    private short tas;

    @Column(name = "tad", nullable = false, updatable = false)
    private short tad;

    @Column(name = "pouls", nullable = false, updatable = false)
    private short pouls;

    @Enumerated(EnumType.STRING)
    @Column(name = "niveau", nullable = false, length = 30, updatable = false)
    private BpLevel niveau;

    @Column(name = "serie_id", updatable = false)
    private UUID serieId;

    @Column(name = "jour", updatable = false)
    private Short jour;

    @Enumerated(EnumType.STRING)
    @Column(name = "moment", length = 10, updatable = false)
    private MeasureMoment moment;

    @Column(name = "rang", updatable = false)
    private Short rang;

    @Column(name = "saisi_par", updatable = false)
    private UUID saisiPar;

    /** Créneau du protocole ; {@code null} pour une mesure ponctuelle. */
    public record Slot(UUID serieId, int jour, MeasureMoment moment, int rang) {

        public Slot {
            if (serieId == null || moment == null || jour < 1 || jour > 3 || rang < 1 || rang > 3) {
                throw new IllegalArgumentException("Créneau invalide (jour 1-3, matin / soir, mesure 1-3)");
            }
        }
    }

    public BpMeasurement(UUID seniorId, Instant dateMesure, int tas, int tad, int pouls, Slot slot, UUID saisiPar) {
        if (pouls < 30 || pouls > 220) {
            throw new IllegalArgumentException("Pouls invalide (30 à 220 bpm)");
        }
        this.seniorId = seniorId;
        this.dateMesure = dateMesure;
        this.tas = (short) tas;
        this.tad = (short) tad;
        this.pouls = (short) pouls;
        this.niveau = BpLevel.classify(tas, tad);
        if (slot != null) {
            this.serieId = slot.serieId();
            this.jour = (short) slot.jour();
            this.moment = slot.moment();
            this.rang = (short) slot.rang();
        }
        this.saisiPar = saisiPar;
    }
}
