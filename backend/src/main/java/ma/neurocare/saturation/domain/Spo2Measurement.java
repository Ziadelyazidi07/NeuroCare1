package ma.neurocare.saturation.domain;

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

/** Mesure au repos de SpO2 et de pouls (table {@code spo2_measurements}), classée à l'enregistrement. */
@Entity
@Table(name = "spo2_measurements")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Spo2Measurement extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "date_mesure", nullable = false, updatable = false)
    private Instant dateMesure;

    @Column(name = "spo2", nullable = false, updatable = false)
    private short spo2;

    @Column(name = "pouls", nullable = false, updatable = false)
    private short pouls;

    @Column(name = "maladie_respiratoire_chronique", nullable = false, updatable = false)
    private boolean maladieRespiratoireChronique;

    @Enumerated(EnumType.STRING)
    @Column(name = "niveau", nullable = false, length = 10, updatable = false)
    private Spo2Level niveau;

    @Column(name = "saisi_par", updatable = false)
    private UUID saisiPar;

    public Spo2Measurement(UUID seniorId, Instant dateMesure, int spo2, int pouls,
                           boolean maladieRespiratoireChronique, UUID saisiPar) {
        this.seniorId = seniorId;
        this.dateMesure = dateMesure;
        this.spo2 = (short) spo2;
        this.pouls = (short) pouls;
        this.maladieRespiratoireChronique = maladieRespiratoireChronique;
        this.niveau = Spo2Level.classify(spo2, maladieRespiratoireChronique);
        this.saisiPar = saisiPar;
    }
}
