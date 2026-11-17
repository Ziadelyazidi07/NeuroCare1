package ma.neurocare.medication.domain;

import java.time.DayOfWeek;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/** Jours exposés par l'API (« LUN » … « DIM », cahier §7.8). */
public enum JourSemaine {
    LUN(DayOfWeek.MONDAY),
    MAR(DayOfWeek.TUESDAY),
    MER(DayOfWeek.WEDNESDAY),
    JEU(DayOfWeek.THURSDAY),
    VEN(DayOfWeek.FRIDAY),
    SAM(DayOfWeek.SATURDAY),
    DIM(DayOfWeek.SUNDAY);

    private final DayOfWeek dayOfWeek;

    JourSemaine(DayOfWeek dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public DayOfWeek dayOfWeek() {
        return dayOfWeek;
    }

    public static JourSemaine of(DayOfWeek day) {
        return values()[day.getValue() - 1];
    }

    public static Set<DayOfWeek> toDaysOfWeek(Collection<JourSemaine> jours) {
        Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        jours.forEach(j -> days.add(j.dayOfWeek));
        return days;
    }

    public static List<JourSemaine> fromMask(short mask) {
        return WeekdayMask.toDays(mask).stream().map(JourSemaine::of).toList();
    }
}
