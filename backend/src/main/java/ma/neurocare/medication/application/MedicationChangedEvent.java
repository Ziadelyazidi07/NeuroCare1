package ma.neurocare.medication.application;

import java.util.UUID;

/**
 * Publié (dans la transaction) à chaque création, modification ou désactivation d'un traitement.
 * Le module {@code reminder} réaligne les prises (cahier §9.1).
 */
public record MedicationChangedEvent(UUID medicationId, UUID seniorId, Kind kind) {

    public enum Kind {
        CREATED,
        UPDATED,
        DEACTIVATED
    }
}
