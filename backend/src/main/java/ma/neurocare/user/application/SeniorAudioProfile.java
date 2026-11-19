package ma.neurocare.user.application;

import java.util.UUID;

import ma.neurocare.common.domain.Language;
import ma.neurocare.user.domain.ReminderSoundMode;

/** Vue d'un senior utile au message vocal : nom affiché, langue et son choisi. */
public record SeniorAudioProfile(UUID seniorId, String nomComplet, Language langue, ReminderSoundMode modeSonRappel) {
}
