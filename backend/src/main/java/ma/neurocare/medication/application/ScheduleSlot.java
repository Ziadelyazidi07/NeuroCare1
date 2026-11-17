package ma.neurocare.medication.application;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Vue publique d'un horaire de traitement, exposée au module {@code reminder}.
 */
public record ScheduleSlot(
        UUID scheduleId,
        UUID medicationId,
        UUID seniorId,
        String nomMedicament,
        String consigne,
        LocalTime heure,
        short joursMask,
        LocalDate dateDebut,
        LocalDate dateFin,
        boolean scheduleActif,
        boolean medicationActif) {

    public boolean active() {
        return scheduleActif && medicationActif;
    }
}
