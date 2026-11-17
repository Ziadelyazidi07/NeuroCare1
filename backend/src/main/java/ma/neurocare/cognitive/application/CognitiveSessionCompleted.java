package ma.neurocare.cognitive.application;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.cognitive.domain.ExerciseType;

/** Exercice enregistré (événement temps réel COGNITIVE_SESSION_COMPLETED, cahier §9.4). */
public record CognitiveSessionCompleted(UUID sessionId, UUID seniorId, ExerciseType typeExercice,
                                        Instant dateExercice, boolean interrompu) {
}
