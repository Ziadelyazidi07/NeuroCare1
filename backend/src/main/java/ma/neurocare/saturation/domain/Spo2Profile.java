package ma.neurocare.saturation.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import ma.neurocare.common.domain.BaseEntity;

/** Profil respiratoire du senior (table {@code spo2_profiles}, identifiant = celui du senior). */
@Entity
@Table(name = "spo2_profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Spo2Profile extends BaseEntity {

    @Column(name = "maladie_respiratoire_chronique", nullable = false)
    private boolean maladieRespiratoireChronique;

    @Column(name = "mis_a_jour_le", nullable = false)
    private Instant misAJourLe;

    public Spo2Profile(UUID seniorId, boolean maladieRespiratoireChronique, Instant now) {
        super(seniorId);
        this.maladieRespiratoireChronique = maladieRespiratoireChronique;
        this.misAJourLe = now;
    }

    public void update(boolean maladieRespiratoireChronique, Instant now) {
        this.maladieRespiratoireChronique = maladieRespiratoireChronique;
        this.misAJourLe = now;
    }
}
