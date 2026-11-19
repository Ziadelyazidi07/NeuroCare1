package ma.neurocare.user.application;

import java.util.UUID;

import ma.neurocare.common.domain.Language;

/** Vue d'un senior utile au message vocal : nom affiché et langue. */
public record SeniorAudioProfile(UUID seniorId, String nomComplet, Language langue) {
}
