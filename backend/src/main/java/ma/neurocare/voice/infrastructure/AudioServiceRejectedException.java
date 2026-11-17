package ma.neurocare.voice.infrastructure;

/**
 * Refus métier du microservice (4xx : langue non prise en charge, voix inconnue, échantillon invalide).
 * Ce n'est pas une panne : ni réessayé, ni compté par le disjoncteur.
 */
public class AudioServiceRejectedException extends RuntimeException {

    private final int status;
    private final String code;

    public AudioServiceRejectedException(int status, String code) {
        super("Refus du service audio (" + status + " " + code + ")");
        this.status = status;
        this.code = code;
    }

    public int status() {
        return status;
    }

    public String code() {
        return code;
    }
}
