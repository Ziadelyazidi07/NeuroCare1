package ma.neurocare.reminder.application;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.reminder.domain.DoseStatus;

/**
 * Événements publiés par le moteur de rappel. Ils sont consommés après commit
 * ({@code @TransactionalEventListener(AFTER_COMMIT)}) par le module {@code notification}
 * (push FCM) et, à l'étape suivante, par le temps réel STOMP.
 */
public final class ReminderEvents {

    private ReminderEvents() {
    }

    /** Une prise est due (premier envoi) ou à relancer : push vers le téléphone du senior. */
    public record DoseReminderDue(UUID doseId, UUID seniorId, UUID medicationId, String nomMedicament,
                                  Instant datePrevue, boolean relance) {
    }

    /** Changement de statut d'une prise (CONFIRME, SANS_REPONSE…). */
    public record DoseStatusChanged(UUID doseId, UUID seniorId, String nomMedicament, Instant datePrevue,
                                    DoseStatus statut) {

        /** Couleur de pastille du tableau de bord (EF-DA-01). */
        public String couleur() {
            return statut.couleur();
        }
    }
}
