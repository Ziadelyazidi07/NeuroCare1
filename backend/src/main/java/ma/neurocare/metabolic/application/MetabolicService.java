package ma.neurocare.metabolic.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.metabolic.api.dto.MetabolicDtos;
import ma.neurocare.metabolic.api.dto.MetabolicDtos.AssessmentDto;
import ma.neurocare.metabolic.api.dto.MetabolicDtos.AssessmentRequest;
import ma.neurocare.metabolic.api.dto.MetabolicDtos.HistoryDto;
import ma.neurocare.metabolic.domain.FindriscAnswers;
import ma.neurocare.metabolic.domain.FindriscAssessment;
import ma.neurocare.metabolic.infrastructure.FindriscAssessmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Module 4 (FINDRISC) : cotation et historique. L'autorisation (le senior lui-même ou un aidant lié avec
 * PARTAGE_FAMILIAL) est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class MetabolicService {

    static final Duration MAX_OFFLINE_DELAY = Duration.ofDays(7);

    private final FindriscAssessmentRepository assessments;
    private final Clock clock;

    @Transactional
    public AssessmentDto record(UUID seniorId, UUID actorId, AssessmentRequest r) {
        FindriscAnswers answers;
        try {
            answers = new FindriscAnswers(r.age(), r.sexe(), r.poidsKg().doubleValue(), r.tailleCm().doubleValue(),
                    r.tourTailleCm(), r.activitePhysique(), r.fruitsLegumesQuotidiens(), r.medicamentsHypertension(),
                    r.glycemieEleveeAntecedent(), r.antecedentsFamiliaux());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, e.getMessage() + ".");
        }
        return toDto(assessments.save(new FindriscAssessment(seniorId, passationDate(r.datePassation()), answers, actorId)));
    }

    @Transactional(readOnly = true)
    public HistoryDto history(UUID seniorId) {
        return new HistoryDto(MetabolicDtos.AVERTISSEMENT, assessments.findTop50BySeniorIdOrderByDatePassationDesc(seniorId)
                .stream().map(MetabolicService::toDto).toList());
    }

    private Instant passationDate(Instant requested) {
        Instant now = clock.instant();
        if (requested == null) {
            return now;
        }
        if (requested.isAfter(now.plusSeconds(60)) || requested.isBefore(now.minus(MAX_OFFLINE_DELAY))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date de passation invalide.");
        }
        return requested;
    }

    static AssessmentDto toDto(FindriscAssessment a) {
        return new AssessmentDto(a.getId(), a.getDatePassation(), a.getAge(), a.getSexe(), a.getPoidsKg(), a.getTailleCm(),
                a.getImc(), a.getTourTailleCm(), a.isActivitePhysique(), a.isFruitsLegumesQuotidiens(),
                a.isMedicamentsHypertension(), a.isGlycemieEleveeAntecedent(), a.getAntecedentsFamiliaux(), a.getPoints(),
                a.getScoreTotal(), a.getNiveau(), a.getNiveau().tenYearPercent(), MetabolicDtos.AVERTISSEMENT);
    }
}
