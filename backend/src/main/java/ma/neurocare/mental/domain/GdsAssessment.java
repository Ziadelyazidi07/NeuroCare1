package ma.neurocare.mental.domain;

import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Passation Mini-GDS / GDS-15 (table {@code gds_assessments}). */
@Entity
@Table(name = "gds_assessments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GdsAssessment extends BaseEntity {

    @Column(name = "senior_id", nullable = false, updatable = false)
    private UUID seniorId;

    @Column(name = "date_passation", nullable = false, updatable = false)
    private Instant datePassation;

    /** Code de question ({@link GdsQuestion}) → réponse Oui (true) / Non (false). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reponses", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Boolean> reponses;

    @Column(name = "score_mini_gds", nullable = false, updatable = false)
    private short scoreMiniGds;

    @Column(name = "score_gds15", updatable = false)
    private Short scoreGds15;

    @Enumerated(EnumType.STRING)
    @Column(name = "niveau", nullable = false, length = 30, updatable = false)
    private GdsLevel niveau;

    @Column(name = "saisi_par", updatable = false)
    private UUID saisiPar;

    public GdsAssessment(UUID seniorId, Instant datePassation, GdsResult result, UUID saisiPar) {
        this.seniorId = seniorId;
        this.datePassation = datePassation;
        this.reponses = new TreeMap<>();
        result.answers().forEach((question, answer) -> reponses.put(question.name(), answer));
        this.scoreMiniGds = (short) result.miniGdsPoints();
        this.scoreGds15 = result.gds15Points() == null ? null : result.gds15Points().shortValue();
        this.niveau = result.level();
        this.saisiPar = saisiPar;
    }
}
