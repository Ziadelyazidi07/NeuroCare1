package ma.neurocare.cognitive.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.cognitive.domain.CognitiveSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CognitiveSessionRepository extends JpaRepository<CognitiveSession, UUID> {

    List<CognitiveSession> findBySeniorIdAndDateExerciceGreaterThanEqualAndDateExerciceLessThanOrderByDateExerciceAsc(
            UUID seniorId, Instant from, Instant to);

    Optional<CognitiveSession> findFirstBySeniorIdOrderByDateExerciceDesc(UUID seniorId);
}
