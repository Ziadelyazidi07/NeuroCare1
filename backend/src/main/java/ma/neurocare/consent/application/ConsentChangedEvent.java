package ma.neurocare.consent.application;

import java.util.UUID;

import ma.neurocare.consent.domain.ConsentType;

/**
 * Publié à chaque changement de consentement. Les modules concernés réagissent
 * (ex. VOIX révoqué → purge des audios, RAPPELS révoqué → prises futures DESACTIVE).
 */
public record ConsentChangedEvent(UUID seniorId, ConsentType type, boolean accorde, UUID auteurId) {
}
