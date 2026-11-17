package ma.neurocare.medication.application;

import java.util.UUID;

/** Vue d'un traitement utile à la génération du message vocal (module {@code voice}). */
public record MedicationAudioInfo(UUID medicationId, UUID seniorId, String nomMedicament, UUID creePar,
                                  boolean actif) {
}
