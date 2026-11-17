package ma.neurocare.user.application;

import java.time.ZoneId;
import java.util.UUID;

/** Vue d'un senior pour l'en-tête du rapport PDF (cahier §11.1). */
public record SeniorReportProfile(UUID seniorId, String nomComplet, Short anneeNaissance, boolean donneesFictives,
                                  ZoneId zone) {
}
