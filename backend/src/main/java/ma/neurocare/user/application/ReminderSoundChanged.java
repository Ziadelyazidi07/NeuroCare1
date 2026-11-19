package ma.neurocare.user.application;

import java.util.UUID;

/** Le son des rappels d'un senior a changé : ses messages sont à préparer dans le nouveau mode. */
public record ReminderSoundChanged(UUID seniorId) {
}
