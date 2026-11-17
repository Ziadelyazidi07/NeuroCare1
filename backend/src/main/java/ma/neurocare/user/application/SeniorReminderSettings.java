package ma.neurocare.user.application;

import java.time.ZoneId;
import java.util.UUID;

/** Paramètres d'un senior utiles au moteur de rappel. */
public record SeniorReminderSettings(UUID seniorId, ZoneId zone, int delaiSansReponseMin) {
}
