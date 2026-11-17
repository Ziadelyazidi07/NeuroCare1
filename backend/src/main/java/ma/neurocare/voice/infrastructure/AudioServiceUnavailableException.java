package ma.neurocare.voice.infrastructure;

/** Service audio injoignable, en erreur, trop lent, ou disjoncteur ouvert : la chaîne de repli s'applique. */
public class AudioServiceUnavailableException extends RuntimeException {

    public AudioServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
