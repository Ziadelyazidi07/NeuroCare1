package ma.neurocare.mental.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.mental.api.dto.MentalDtos;
import ma.neurocare.mental.api.dto.MentalDtos.AssessmentDto;
import ma.neurocare.mental.api.dto.MentalDtos.AssessmentRequest;
import ma.neurocare.mental.api.dto.MentalDtos.HistoryDto;
import ma.neurocare.mental.domain.GdsAssessment;
import ma.neurocare.mental.domain.GdsQuestion;
import ma.neurocare.mental.domain.GdsResult;
import ma.neurocare.mental.infrastructure.GdsAssessmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Module 3 (santé mentale) : cotation Mini-GDS puis GDS-15 et historique. L'autorisation (le senior
 * lui-même ou un aidant lié avec PARTAGE_FAMILIAL) est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class MentalService {

    static final Duration MAX_OFFLINE_DELAY = Duration.ofDays(7);

    private final GdsAssessmentRepository assessments;
    private final Clock clock;

    @Transactional
    public AssessmentDto record(UUID seniorId, UUID actorId, AssessmentRequest request) {
        Map<GdsQuestion, Boolean> answers = new EnumMap<>(GdsQuestion.class);
        request.reponses().forEach((code, answer) -> answers.put(question(code), answer));
        GdsResult result;
        try {
            result = GdsResult.evaluate(answers);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, e.getMessage() + ".");
        }
        return toDto(assessments.save(new GdsAssessment(seniorId, passationDate(request.datePassation()), result, actorId)));
    }

    @Transactional(readOnly = true)
    public HistoryDto history(UUID seniorId) {
        return new HistoryDto(MentalDtos.AVERTISSEMENT, assessments.findTop50BySeniorIdOrderByDatePassationDesc(seniorId)
                .stream().map(MentalService::toDto).toList());
    }

    private static GdsQuestion question(String code) {
        try {
            return GdsQuestion.valueOf(code);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Question inconnue : " + code + ".");
        }
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

    static AssessmentDto toDto(GdsAssessment a) {
        return new AssessmentDto(a.getId(), a.getDatePassation(), a.getReponses(), a.getScoreMiniGds(),
                a.getScoreGds15() == null ? null : a.getScoreGds15().intValue(), a.getNiveau(), MentalDtos.AVERTISSEMENT);
    }
}
