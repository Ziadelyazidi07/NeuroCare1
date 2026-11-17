package ma.neurocare.reminder.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditService;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.medication.application.ScheduleSlot;
import ma.neurocare.reminder.api.dto.DoseDtos.DoseDto;
import ma.neurocare.reminder.application.ReminderEvents.DoseStatusChanged;
import ma.neurocare.reminder.domain.ConfirmationOutcome;
import ma.neurocare.reminder.domain.DoseEvent;
import ma.neurocare.reminder.infrastructure.DoseEventRepository;
import ma.neurocare.user.application.SeniorReminderSettings;
import ma.neurocare.user.application.SeniorService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lecture des prises et confirmation par le senior (EF-RE-03, EF-RE-06, CA-02, CA-04).
 */
@Service
@RequiredArgsConstructor
public class DoseService {

    static final String AUDIT_LATE_CONFIRMATION = "DOSE_CONFIRMATION_AFTER_CLOSURE";

    private final DoseEventRepository doses;
    private final MedicationService medicationService;
    private final SeniorService seniorService;
    private final AuditService auditService;
    private final ApplicationEventPublisher events;
    private final NeuroCareProperties properties;
    private final Clock clock;

    /** Résultat d'une confirmation : la prise à jour et ce qui s'est passé. */
    public record ConfirmationResult(DoseDto dose, ConfirmationOutcome outcome) {
    }

    // ---------- Lecture ----------

    /** Prises d'une journée locale du senior. */
    @Transactional(readOnly = true)
    public List<DoseDto> dosesOfDay(UUID seniorId, LocalDate day) {
        ZoneId zone = settings(seniorId).zone();
        return toDtos(doses.findForSenior(seniorId, day.atStartOfDay(zone).toInstant(),
                day.plusDays(1).atStartOfDay(zone).toInstant()));
    }

    /** Prises du {@code firstDay} au {@code lastDay} inclus (jours locaux du senior). */
    @Transactional(readOnly = true)
    public List<DoseDto> dosesBetween(UUID seniorId, LocalDate firstDay, LocalDate lastDay) {
        ZoneId zone = settings(seniorId).zone();
        return toDtos(doses.findForSenior(seniorId, firstDay.atStartOfDay(zone).toInstant(),
                lastDay.plusDays(1).atStartOfDay(zone).toInstant()));
    }

    /** Fuseau du senior (jours du tableau de bord). */
    @Transactional(readOnly = true)
    public ZoneId zoneOf(UUID seniorId) {
        return settings(seniorId).zone();
    }

    @Transactional(readOnly = true)
    public List<DoseDto> today(UUID seniorId) {
        return dosesOfDay(seniorId, LocalDate.now(clock.withZone(settings(seniorId).zone())));
    }

    /** Prises des prochaines heures, pour programmer les notifications locales (cahier §9.5). */
    @Transactional(readOnly = true)
    public List<DoseDto> upcoming(UUID seniorId, int hours) {
        Instant now = clock.instant();
        return toDtos(doses.findForSenior(seniorId, now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(hours))));
    }

    // ---------- Confirmation ----------

    /**
     * « C'est fait ». Rejouer la même clé renvoie la même réponse sans effet (idempotence).
     * La prise doit appartenir au senior appelant (404 sinon).
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public ConfirmationResult confirm(UUID doseId, UUID seniorId, String idempotencyKey, Instant horodatageClient) {
        DoseEvent dose = doses.findForUpdate(doseId)
                .filter(d -> d.getSeniorId().equals(seniorId))
                .orElseThrow(() -> BusinessException.notFound("Prise introuvable."));

        Duration timeout = properties.reminder().effectiveTimeout(settings(seniorId).delaiSansReponseMin());
        ConfirmationOutcome outcome = dose.confirm(idempotencyKey, horodatageClient, clock.instant(), timeout);

        switch (outcome) {
            case APPLIED, APPLIED_LATE -> {
                doses.flush();
                events.publishEvent(new DoseStatusChanged(dose.getId(), seniorId, nameOf(dose),
                        dose.getDatePrevue(), dose.getStatut()));
            }
            case ALREADY_APPLIED -> {
                // rien à faire : même réponse que la première fois
            }
            case REJECTED_AFTER_CLOSURE -> {
                auditService.record(seniorId, AUDIT_LATE_CONFIRMATION, "DOSE_EVENT", doseId);
                throw BusinessException.invalidTransition(
                        "La prise a été clôturée sans réponse avant cette confirmation.");
            }
            case REJECTED_FINAL -> throw BusinessException.invalidTransition(
                    "La prise est déjà clôturée (" + dose.getStatut() + ").");
        }
        return new ConfirmationResult(toDtos(List.of(dose)).getFirst(), outcome);
    }

    /** Variante pour la synchronisation : chaque élément dans sa propre transaction. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessException.class)
    public ConfirmationResult confirmIsolated(UUID doseId, UUID seniorId, String key, Instant horodatageClient) {
        return confirm(doseId, seniorId, key, horodatageClient);
    }

    @Transactional(readOnly = true)
    public DoseDto get(UUID doseId, UUID seniorId) {
        return doses.findById(doseId)
                .filter(d -> d.getSeniorId().equals(seniorId))
                .map(d -> toDtos(List.of(d)).getFirst())
                .orElseThrow(() -> BusinessException.notFound("Prise introuvable."));
    }

    // ---------- Utilitaires ----------

    private SeniorReminderSettings settings(UUID seniorId) {
        SeniorReminderSettings settings = seniorService.reminderSettings(Set.of(seniorId)).get(seniorId);
        if (settings == null) {
            throw BusinessException.notFound("Senior introuvable.");
        }
        return settings;
    }

    private String nameOf(DoseEvent dose) {
        return medicationService.slotsByIds(Set.of(dose.getScheduleId())).stream()
                .findFirst().map(ScheduleSlot::nomMedicament).orElse(null);
    }

    private List<DoseDto> toDtos(List<DoseEvent> list) {
        Map<UUID, ScheduleSlot> slots = medicationService.slotsByIds(
                        list.stream().map(DoseEvent::getScheduleId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(ScheduleSlot::scheduleId, Function.identity()));
        return list.stream().map(d -> {
            ScheduleSlot slot = slots.get(d.getScheduleId());
            return new DoseDto(d.getId(), slot == null ? null : slot.medicationId(),
                    slot == null ? null : slot.nomMedicament(), slot == null ? null : slot.consigne(),
                    d.getDatePrevue(), d.getStatut(), d.getHorodatageAction());
        }).toList();
    }
}
