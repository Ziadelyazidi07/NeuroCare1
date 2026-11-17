package ma.neurocare.common.validation;

/** Expressions régulières partagées par la validation des DTO. */
public final class Patterns {

    /** Numéro de téléphone au format E.164 (ex. +212612345678). */
    public static final String E164 = "^\\+[1-9]\\d{7,14}$";

    private Patterns() {
    }
}
