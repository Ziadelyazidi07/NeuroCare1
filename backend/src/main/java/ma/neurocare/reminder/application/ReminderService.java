package ma.neurocare.reminder.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.consent.application.ConsentChangedEvent;
import ma.neurocare.consent.application.ConsentService;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.medication.application.MedicationChangedEvent;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.medication.application.ScheduleSlot;
import ma.neurocare.reminder.application.ReminderEvents.DoseReminderDue;
import ma.neurocare.reminder.application.ReminderEvents.DoseStatusChanged;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.domain.DoseScheduleCalculator;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.reminder.infrastructure.DoseEventJdbcRepository;
import ma.neurocare.reminder.infrastructure.DoseEventJdbcRepository.ClosedDose;
import ma.neurocare.reminder.infrastructure.DoseEventRepository;
import ma.neurocare.user.application.SeniorReminderSettings;
import ma.neurocare.user.application.SeniorService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moteur de rappel (cahier §9) : génération des prises, envoi, relance, clôture SANS_REPONSE,
 * et réalignement des prises quand un traitement ou le consentement RAPPELS change.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReminderService {

    private final DoseEventRepository doses;
    private final DoseEventJdbcRepository dosesJdbc;
    private final MedicationService medicationService;
    private final SeniorService seniorService;
    private final ConsentService consentService;
    private final ApplicationEventPublisher events;
    private final NeuroCareProperties properties;
    private final Clock clock;

    // ---------- Génération ----------

    /**
     * Job 00:05 : prises des {@code lookaheadDays} jours à partir de {@code firstDay} (date locale de
     * chaque senior), pour les seniors ayant accordé RAPPELS. Idempotent.
     */
    @Transactional
    public int generateFrom(LocalDate firstDay) {
        return generate(medicationService.allActiveSlots(), firstDay, null);
    }

    /** Rattrapage au démarrage ou après un changement : uniquement les prises futures. */
    @Transactional
    public int generateUpcoming() {
        return generate(medicationService.allActiveSlots(), null, clock.instant());
    }

    private int generate(List<ScheduleSlot> slots, LocalDate firstDay, Instant notBefore) {
        if (slots.isEmpty()) {
            return 0;
        }
        Set<UUID> seniorIds = slots.stream().map(ScheduleSlot::seniorId).collect(Collectors.toSet());
        Set<UUID> withConsent = consentService.seniorsWithConsent(seniorIds, ConsentType.RAPPELS);
        Map<UUID, SeniorReminderSettings> settings = seniorService.reminderSettings(withConsent);
        int days = properties.reminder().lookaheadDays();

        int created = 0;
        for (ScheduleSlot slot : slots) {
            SeniorReminderSettings senior = settings.get(slot.seniorId());
            if (senior == null || !slot.active()) {
                continue;
            }
            LocalDate start = firstDay != null ? firstDay : LocalDate.ofInstant(notBefore, senior.zone());
            for (Instant at : DoseScheduleCalculator.occurrences(toCalculatorSlot(slot), start, days,
                    senior.zone(), notBefore)) {
                if (dosesJdbc.insertIfAbsent(slot.scheduleId(), slot.seniorId(), at)) {
                    created++;
                }
            }
        }
        log.debug("{} prise(s) générée(s)", created);
        return created;
    }

    // ---------- Réalignement ----------

    /**
     * Traitement créé / modifié / désactivé (dans la transaction du module medication) :
     * <ul>
     *   <li>désactivé, ou horaire retiré → prises en attente DESACTIVE (EF-RE-07) ;</li>
     *   <li>modifié → prises futures qui ne correspondent plus aux horaires supprimées puis régénérées.</li>
     * </ul>
     */
    @EventListener
    public void onMedicationChanged(MedicationChangedEvent event) {
        List<ScheduleSlot> slots = medicationService.slotsOfMedication(event.medicationId());
        List<UUID> inactive = slots.stream().filter(s -> !s.active()).map(ScheduleSlot::scheduleId).toList();
        if (!inactive.isEmpty()) {
            doses.deactivatePendingBySchedules(inactive);
        }
        List<ScheduleSlot> active = slots.stream().filter(ScheduleSlot::active).toList();
        if (event.kind() == MedicationChangedEvent.Kind.UPDATED) {
            removeObsoleteFutureDoses(active, event.seniorId());
        }
        generate(active, null, clock.instant());
    }

    /** RAPPELS révoqué → prises en attente DESACTIVE ; RAPPELS accordé → prises à venir générées. */
    @EventListener
    public void onConsentChanged(ConsentChangedEvent event) {
        if (event.type() != ConsentType.RAPPELS) {
            return;
        }
        if (event.accorde()) {
            generate(medicationService.activeSlotsOfSenior(event.seniorId()), null, clock.instant());
        } else {
            int count = doses.deactivatePendingBySenior(event.seniorId());
            log.debug("Consentement RAPPELS révoqué : {} prise(s) désactivée(s)", count);
        }
    }

    private void removeObsoleteFutureDoses(List<ScheduleSlot> activeSlots, UUID seniorId) {
        if (activeSlots.isEmpty()) {
            return;
        }
        Instant now = clock.instant();
        SeniorReminderSettings senior = seniorService.reminderSettings(Set.of(seniorId)).get(seniorId);
        if (senior == null) {
            return;
        }
        Map<UUID, ScheduleSlot> byId = activeSlots.stream()
                .collect(Collectors.toMap(ScheduleSlot::scheduleId, Function.identity()));
        for (DoseEvent dose : doses.findPendingAfter(byId.keySet(), now)) {
            ScheduleSlot slot = byId.get(dose.getScheduleId());
            LocalDate day = LocalDate.ofInstant(dose.getDatePrevue(), senior.zone());
            boolean stillExpected = DoseScheduleCalculator.occurrenceOn(toCalculatorSlot(slot), day, senior.zone())
                    .filter(dose.getDatePrevue()::equals)
                    .isPresent();
            if (!stillExpected && !dose.isNotificationEnvoyee()) {
                doses.delete(dose);
            }
        }
        doses.flush();
    }

    // ---------- Envoi et relance ----------

    /**
     * Job minute : premier envoi des prises échues, puis relance unique à +{@code relanceAfter}
     * (EF-RE-02, EF-RE-05). Les push partent après commit, en asynchrone.
     */
    @Transactional
    public int dispatchDue(Instant now) {
        List<DoseEvent> due = doses.findDueForNotification(now);
        List<DoseEvent> relances = doses.findDueForRelance(now.minus(properties.reminder().relanceAfter()));
        Map<UUID, ScheduleSlot> slots = slotsOf(due, relances);

        due.forEach(dose -> {
            dose.markNotificationSent();
            events.publishEvent(reminderEvent(dose, slots.get(dose.getScheduleId()), false));
        });
        relances.forEach(dose -> {
            dose.markRelanceSent();
            events.publishEvent(reminderEvent(dose, slots.get(dose.getScheduleId()), true));
        });
        return due.size() + relances.size();
    }

    // ---------- Clôture ----------

    /** Job minute : EN_ATTENTE → SANS_REPONSE après le délai du senior, alerte aidant (EF-RE-04). */
    @Transactional
    public List<UUID> closeExpired(Instant now) {
        List<ClosedDose> closed = dosesJdbc.closeExpired(now, properties.reminder().timeoutOverride());
        if (closed.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> names = medicationService.slotsByIds(
                        closed.stream().map(ClosedDose::scheduleId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(ScheduleSlot::scheduleId, ScheduleSlot::nomMedicament));
        closed.forEach(c -> events.publishEvent(new DoseStatusChanged(c.doseId(), c.seniorId(),
                names.get(c.scheduleId()), c.datePrevue(), DoseStatus.SANS_REPONSE)));
        log.info("{} prise(s) clôturée(s) sans réponse", closed.size());
        return closed.stream().map(ClosedDose::doseId).toList();
    }

    // ---------- Utilitaires ----------

    @SafeVarargs
    private Map<UUID, ScheduleSlot> slotsOf(Collection<DoseEvent>... groups) {
        Set<UUID> scheduleIds = new HashSet<>();
        for (Collection<DoseEvent> group : groups) {
            group.forEach(d -> scheduleIds.add(d.getScheduleId()));
        }
        return medicationService.slotsByIds(scheduleIds).stream()
                .collect(Collectors.toMap(ScheduleSlot::scheduleId, Function.identity()));
    }

    private static DoseReminderDue reminderEvent(DoseEvent dose, ScheduleSlot slot, boolean relance) {
        return new DoseReminderDue(dose.getId(), dose.getSeniorId(), slot == null ? null : slot.medicationId(),
                slot == null ? null : slot.nomMedicament(), dose.getDatePrevue(), relance);
    }

    static DoseScheduleCalculator.Slot toCalculatorSlot(ScheduleSlot slot) {
        return new DoseScheduleCalculator.Slot(slot.heure(), slot.joursMask(), slot.dateDebut(), slot.dateFin());
    }
}
