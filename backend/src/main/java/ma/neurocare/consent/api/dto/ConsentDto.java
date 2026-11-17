package ma.neurocare.consent.api.dto;

import java.time.Instant;

import ma.neurocare.consent.domain.ConsentType;

/** État d'un consentement ; {@code versionTexte} et {@code dateMaj} sont nuls s'il n'a jamais été exprimé. */
public record ConsentDto(ConsentType type, boolean accorde, String versionTexte, Instant dateMaj) {
}
