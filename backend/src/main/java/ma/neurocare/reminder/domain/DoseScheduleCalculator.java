package ma.neurocare.reminder.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import ma.neurocare.medication.domain.WeekdayMask;

/**
 * Calcul des instants de prise (UTC) à partir d'un horaire exprimé dans le fuseau du senior.
 * Fonction pure, sans accès base : testée unitairement.
 */
public final class DoseScheduleCalculator {

    private DoseScheduleCalculator() {
    }

    /**
     * Description d'un horaire suffisante pour le calcul.
     *
     * @param heure     heure locale de rappel
     * @param joursMask masque binaire des jours (lundi = 1 … dimanche = 64)
     * @param dateDebut premier jour du traitement (inclus)
     * @param dateFin   dernier jour du traitement (inclus), {@code null} si sans fin
     */
    public record Slot(LocalTime heure, short joursMask, LocalDate dateDebut, LocalDate dateFin) {

        boolean activeOn(LocalDate date) {
            return !date.isBefore(dateDebut)
                    && (dateFin == null || !date.isAfter(dateFin))
                    && WeekdayMask.contains(joursMask, date.getDayOfWeek());
        }
    }

    /**
     * Instant prévu pour {@code date} dans le fuseau {@code zone}, ou vide si l'horaire ne s'applique pas
     * ce jour-là. Lors d'un passage à l'heure d'été, une heure inexistante est décalée vers l'avant.
     */
    public static Optional<Instant> occurrenceOn(Slot slot, LocalDate date, ZoneId zone) {
        if (!slot.activeOn(date)) {
            return Optional.empty();
        }
        return Optional.of(ZonedDateTime.of(date, slot.heure(), zone).toInstant());
    }

    /**
     * Occurrences sur {@code days} jours consécutifs à partir de {@code firstDay}, en ignorant celles
     * antérieures à {@code notBefore} (une prise créée en cours de journée ne remonte pas dans le passé).
     */
    public static List<Instant> occurrences(Slot slot, LocalDate firstDay, int days, ZoneId zone, Instant notBefore) {
        List<Instant> result = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            occurrenceOn(slot, firstDay.plusDays(i), zone)
                    .filter(instant -> notBefore == null || !instant.isBefore(notBefore))
                    .ifPresent(result::add);
        }
        return result;
    }
}
