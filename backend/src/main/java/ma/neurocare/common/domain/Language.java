package ma.neurocare.common.domain;

/**
 * Langues prises en charge (cahier §6.2). Stockées en VARCHAR(10).
 * Évolutions prévues : TZM, RIF, SHI.
 */
public enum Language {
    DARIJA("ar-MA"),
    FR("fr"),
    AR("ar");

    private final String code;

    Language(String code) {
        this.code = code;
    }

    /** Code transmis au microservice audio. */
    public String code() {
        return code;
    }
}
