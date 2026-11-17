package ma.neurocare.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Codes métier exposés dans le champ {@code code} des réponses RFC 7807 (cahier §7.8 et §7.9).
 */
public enum ErrorCode {

    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Requête invalide"),
    PAIRING_CODE_INVALID(HttpStatus.BAD_REQUEST, "Code d'appairage invalide"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Authentification requise"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Identifiants invalides"),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "Refresh token invalide"),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "Accès refusé"),
    CONSENT_REQUIRED(HttpStatus.FORBIDDEN, "Consentement requis"),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Ressource introuvable"),
    INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT, "Transition de statut interdite"),
    PHONE_ALREADY_USED(HttpStatus.CONFLICT, "Téléphone déjà utilisé"),
    CONFLICT(HttpStatus.CONFLICT, "Conflit"),
    PAYLOAD_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "Fichier trop volumineux"),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS, "Trop de tentatives"),
    AUDIO_SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Service audio indisponible"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur interne");

    private final HttpStatus status;
    private final String title;

    ErrorCode(HttpStatus status, String title) {
        this.status = status;
        this.title = title;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return title;
    }

    /** Suffixe d'URI de type : {@code CONSENT_REQUIRED} → {@code consent-required}. */
    public String slug() {
        return name().toLowerCase().replace('_', '-');
    }
}
