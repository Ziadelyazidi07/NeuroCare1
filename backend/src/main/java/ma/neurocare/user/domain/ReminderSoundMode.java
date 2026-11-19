package ma.neurocare.user.domain;

/** Son joué pour les rappels d'un senior. */
public enum ReminderSoundMode {
    /** Voix de synthèse standard, sinon audio générique embarqué : aucun enregistrement nécessaire. */
    STANDARD,
    /** Voix de l'aidant (clonée, sinon son enregistrement), avec repli sur le son standard. */
    PERSONNALISE
}
