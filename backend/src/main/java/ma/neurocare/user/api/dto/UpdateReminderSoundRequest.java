package ma.neurocare.user.api.dto;

import jakarta.validation.constraints.NotNull;
import ma.neurocare.user.domain.ReminderSoundMode;

/** Choix du son des rappels. */
public record UpdateReminderSoundRequest(@NotNull ReminderSoundMode mode) {
}
