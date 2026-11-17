package ma.neurocare.reminder.domain;

/** Résultat d'une demande de confirmation sur une prise. */
public enum ConfirmationOutcome {
    /** La prise passe en CONFIRME. */
    APPLIED,
    /** Même clé d'idempotence déjà appliquée : réponse identique, aucun changement (CA-04). */
    ALREADY_APPLIED,
    /** Confirmation hors ligne antérieure à la clôture : SANS_REPONSE → CONFIRME (cahier §9.1). */
    APPLIED_LATE,
    /** Confirmation arrivée après la clôture : refusée, la prise reste SANS_REPONSE (à auditer). */
    REJECTED_AFTER_CLOSURE,
    /** Prise déjà confirmée (autre clé) ou désactivée. */
    REJECTED_FINAL
}
