package ma.neurocare.reminder.application;

import java.time.Clock;
import java.time.LocalDate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.config.NeuroCareProperties;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Les trois jobs du moteur de rappel (cahier §9.2), protégés par ShedLock pour ne s'exécuter
 * qu'une fois même avec plusieurs instances.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "neurocare.reminder.scheduling-enabled", havingValue = "true", matchIfMissing = true)
public class ReminderScheduler {

    private final ReminderService reminderService;
    private final NeuroCareProperties properties;
    private final Clock clock;

    /** Chaque jour à 00:05 (Africa/Casablanca) : prises des prochains jours en EN_ATTENTE. */
    @Scheduled(cron = "0 5 0 * * *", zone = "Africa/Casablanca")
    @SchedulerLock(name = "generateDailyDoses", lockAtMostFor = "PT10M")
    public void generateDailyDoses() {
        reminderService.generateFrom(LocalDate.now(clock.withZone(properties.timezone())));
    }

    /** Envoi des rappels échus et relance unique. */
    @Scheduled(fixedDelayString = "${neurocare.reminder.tick:PT1M}")
    @SchedulerLock(name = "dispatchDueReminders", lockAtMostFor = "PT55S")
    public void dispatchDueReminders() {
        reminderService.dispatchDue(clock.instant());
    }

    /** Clôture SANS_REPONSE et alerte de l'aidant. */
    @Scheduled(fixedDelayString = "${neurocare.reminder.tick:PT1M}")
    @SchedulerLock(name = "closeExpiredDoses", lockAtMostFor = "PT55S")
    public void closeExpiredDoses() {
        reminderService.closeExpired(clock.instant());
    }

    /** Au démarrage, rattrape les prises à venir non générées (serveur arrêté à 00:05, déploiement…). */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStartup() {
        int created = reminderService.generateUpcoming();
        log.info("Démarrage du moteur de rappel : {} prise(s) à venir générée(s)", created);
    }
}
