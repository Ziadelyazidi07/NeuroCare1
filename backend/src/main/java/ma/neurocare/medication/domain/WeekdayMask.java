package ma.neurocare.medication.domain;

import java.time.DayOfWeek;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;

/**
 * Conversion entre jours de la semaine et masque binaire {@code jours_semaine}
 * (lundi = 1, mardi = 2, … dimanche = 64 ; 127 = tous les jours).
 */
public final class WeekdayMask {

    public static final short ALL_DAYS = 127;

    private WeekdayMask() {
    }

    public static short bit(DayOfWeek day) {
        return (short) (1 << (day.getValue() - 1));
    }

    public static short of(Collection<DayOfWeek> days) {
        if (days == null || days.isEmpty()) {
            throw new IllegalArgumentException("Au moins un jour de la semaine est requis");
        }
        int mask = 0;
        for (DayOfWeek day : days) {
            mask |= bit(day);
        }
        return (short) mask;
    }

    public static boolean contains(short mask, DayOfWeek day) {
        return (mask & bit(day)) != 0;
    }

    public static Set<DayOfWeek> toDays(short mask) {
        if (mask <= 0 || mask > ALL_DAYS) {
            throw new IllegalArgumentException("Masque de jours invalide : " + mask);
        }
        Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        for (DayOfWeek day : DayOfWeek.values()) {
            if (contains(mask, day)) {
                days.add(day);
            }
        }
        return days;
    }
}
