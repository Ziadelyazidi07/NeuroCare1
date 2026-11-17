package ma.neurocare.cognitive.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.cognitive.api.dto.CognitiveDtos;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.ExerciseDto;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionDto;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionHistoryDto;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.SessionRequest;
import ma.neurocare.cognitive.api.dto.CognitiveDtos.WordDto;
import ma.neurocare.cognitive.domain.CognitiveSession;
import ma.neurocare.cognitive.domain.ExerciseType;
import ma.neurocare.cognitive.domain.WordBank;
import ma.neurocare.cognitive.domain.WordBank.Draw;
import ma.neurocare.cognitive.domain.WordRecallResult;
import ma.neurocare.cognitive.infrastructure.CognitiveSessionRepository;
import ma.neurocare.common.domain.Language;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.user.application.SeniorService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exercices de rappel de mots (EF-CG-01 à 03) : facultatifs, interruptibles, résultats bruts.
 * L'autorisation (le senior lui-même + EXERCICES) est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class CognitiveService {

    /** Pause entre la présentation et le rappel (cahier §6.4 : 60 s). */
    static final int DEFAULT_RECALL_DELAY_SEC = 60;
    /** Une session faite hors ligne peut être envoyée plus tard, dans cette limite. */
    static final Duration MAX_OFFLINE_DELAY = Duration.ofDays(7);

    private final CognitiveSessionRepository sessions;
    private final SeniorService seniorService;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final Random random = new Random();

    @Transactional(readOnly = true)
    public ExerciseDto next(UUID seniorId, ExerciseType type, int count) {
        requireSupported(type);
        if (count < WordBank.MIN_WORDS || count > WordBank.MAX_WORDS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Le nombre de mots doit être compris entre 3 et 5.");
        }
        Language langue = seniorService.audioProfile(seniorId).langue();
        Draw draw = WordBank.draw(langue, count, random);
        return new ExerciseDto(type, langue, toDtos(draw.motsPresentes()), toDtos(draw.propositions()),
                DEFAULT_RECALL_DELAY_SEC, true);
    }

    @Transactional
    public SessionDto record(UUID seniorId, SessionRequest request) {
        requireSupported(request.type());
        WordRecallResult result;
        try {
            result = new WordRecallResult(request.motsPresentes(), request.propositions(), request.motsChoisis(),
                    request.delaiRappelSec(), request.tempsReponseMs(), request.interrompu());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, e.getMessage() + ".");
        }
        Language langue = seniorService.audioProfile(seniorId).langue();
        if (!request.motsPresentes().stream().allMatch(m -> WordBank.find(langue, m).isPresent())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Mots inconnus de la banque de mots.");
        }

        CognitiveSession session = sessions.save(new CognitiveSession(seniorId, exerciseDate(request.dateExercice()),
                request.type(), langue, result.toRawJson(), result.tauxReussite(), request.dureeSec(),
                request.interrompu()));
        events.publishEvent(new CognitiveSessionCompleted(session.getId(), seniorId, session.getTypeExercice(),
                session.getDateExercice(), session.isInterrompu()));
        return toDto(session);
    }

    /** Historique descriptif pour l'aidant (EF-CG-04), toujours accompagné de la mention de non-diagnostic. */
    @Transactional(readOnly = true)
    public SessionHistoryDto history(UUID seniorId, Instant from, Instant to) {
        List<SessionDto> list = sessions
                .findBySeniorIdAndDateExerciceGreaterThanEqualAndDateExerciceLessThanOrderByDateExerciceAsc(
                        seniorId, from, to)
                .stream().map(CognitiveService::toDto).toList();
        return new SessionHistoryDto(CognitiveDtos.AVERTISSEMENT, list);
    }

    @Transactional(readOnly = true)
    public Optional<SessionDto> latest(UUID seniorId) {
        return sessions.findFirstBySeniorIdOrderByDateExerciceDesc(seniorId).map(CognitiveService::toDto);
    }

    private Instant exerciseDate(Instant requested) {
        Instant now = clock.instant();
        if (requested == null) {
            return now;
        }
        if (requested.isAfter(now.plusSeconds(60)) || requested.isBefore(now.minus(MAX_OFFLINE_DELAY))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date d'exercice invalide.");
        }
        return requested;
    }

    private static void requireSupported(ExerciseType type) {
        if (type != ExerciseType.RAPPEL_MOTS) {
            // EF-CG-05 (association image–mot) : priorité C, hors MVP.
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Type d'exercice non disponible : " + type + ".");
        }
    }

    private static List<WordDto> toDtos(List<WordBank.Word> words) {
        return words.stream().map(w -> new WordDto(w.mot(), w.ecritureArabe())).toList();
    }

    @SuppressWarnings("unchecked")
    static SessionDto toDto(CognitiveSession s) {
        Map<String, Object> raw = s.getResultatBrut();
        int presented = raw.get("mots_presentes") instanceof List<?> list ? list.size() : 0;
        int corrects = raw.get("corrects") instanceof Number n ? n.intValue() : 0;
        return new SessionDto(s.getId(), s.getDateExercice(), s.getTypeExercice(), s.getLangue(), presented, corrects,
                s.getTauxReussite(), s.getDureeSec(), s.isInterrompu(), raw);
    }
}
