package ma.neurocare.medication.application;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.medication.api.dto.MedicationDtos.HoraireDto;
import ma.neurocare.medication.api.dto.MedicationDtos.HoraireRequest;
import ma.neurocare.medication.api.dto.MedicationDtos.MedicationDto;
import ma.neurocare.medication.api.dto.MedicationDtos.MedicationRequest;
import ma.neurocare.medication.application.MedicationChangedEvent.Kind;
import ma.neurocare.medication.domain.JourSemaine;
import ma.neurocare.medication.domain.Medication;
import ma.neurocare.medication.infrastructure.MedicationRepository;
import ma.neurocare.medication.infrastructure.ScheduleSlotRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Traitements saisis par l'aidant (EF-ME-01 à 03). L'autorisation (lien + RAPPELS) est vérifiée
 * en amont par {@code AccessPolicy}. Chaque changement publie un {@link MedicationChangedEvent}.
 */
@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationRepository medications;
    private final ScheduleSlotRepository slots;
    private final ApplicationEventPublisher events;

    @Transactional
    public MedicationDto create(UUID seniorId, MedicationRequest request, UUID creatorId) {
        Medication medication = newMedication(seniorId, request, creatorId);
        medication.replaceSchedules(toSchedules(request.horaires()));
        medications.saveAndFlush(medication);
        events.publishEvent(new MedicationChangedEvent(medication.getId(), seniorId, Kind.CREATED));
        return toDto(medication);
    }

    @Transactional(readOnly = true)
    public List<MedicationDto> listActive(UUID seniorId) {
        return medications.findActiveWithSchedules(seniorId).stream().map(MedicationService::toDto).toList();
    }

    @Transactional
    public MedicationDto update(UUID medicationId, MedicationRequest request) {
        Medication medication = load(medicationId);
        if (!medication.isActif()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Ce traitement est désactivé.");
        }
        try {
            medication.describe(request.nomMedicament().strip(), request.consigne(), request.dateDebut(),
                    request.dateFin());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "La date de fin précède la date de début.");
        }
        medication.replaceSchedules(toSchedules(request.horaires()));
        medications.flush();
        events.publishEvent(new MedicationChangedEvent(medicationId, medication.getSeniorId(), Kind.UPDATED));
        return toDto(medication);
    }

    /** Soft delete : l'historique est conservé, les prises en attente passent en DESACTIVE. */
    @Transactional
    public MedicationDto deactivate(UUID medicationId) {
        Medication medication = load(medicationId);
        if (medication.isActif()) {
            medication.deactivate();
            medications.flush();
            events.publishEvent(new MedicationChangedEvent(medicationId, medication.getSeniorId(), Kind.DEACTIVATED));
        }
        return toDto(medication);
    }

    /** Senior propriétaire d'un traitement (pour {@code @PreAuthorize}) ; 404 s'il n'existe pas. */
    @Transactional(readOnly = true)
    public UUID seniorIdOf(UUID medicationId) {
        return medications.findSeniorId(medicationId)
                .orElseThrow(() -> BusinessException.notFound("Traitement introuvable."));
    }

    // ---------- Vues pour le module voice ----------

    @Transactional(readOnly = true)
    public MedicationAudioInfo audioInfo(UUID medicationId) {
        Medication m = medications.findById(medicationId)
                .orElseThrow(() -> BusinessException.notFound("Traitement introuvable."));
        return new MedicationAudioInfo(m.getId(), m.getSeniorId(), m.getNomMedicament(), m.getCreePar(), m.isActif());
    }

    @Transactional(readOnly = true)
    public List<UUID> activeMedicationIds(UUID seniorId) {
        return medications.findActiveWithSchedules(seniorId).stream().map(Medication::getId).toList();
    }

    // ---------- Vues pour le moteur de rappel ----------

    @Transactional(readOnly = true)
    public List<ScheduleSlot> allActiveSlots() {
        return slots.findAllActive();
    }

    @Transactional(readOnly = true)
    public List<ScheduleSlot> activeSlotsOfSenior(UUID seniorId) {
        return slots.findActiveBySenior(seniorId);
    }

    @Transactional(readOnly = true)
    public List<ScheduleSlot> slotsOfMedication(UUID medicationId) {
        return slots.findByMedication(medicationId);
    }

    @Transactional(readOnly = true)
    public List<ScheduleSlot> slotsByIds(Collection<UUID> scheduleIds) {
        return scheduleIds.isEmpty() ? List.of() : slots.findByIds(scheduleIds);
    }

    // ---------- Interne ----------

    private static Medication newMedication(UUID seniorId, MedicationRequest request, UUID creatorId) {
        try {
            return new Medication(seniorId, request.nomMedicament().strip(), request.consigne(),
                    request.dateDebut(), request.dateFin(), creatorId);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "La date de fin précède la date de début.");
        }
    }

    private static Map<LocalTime, Set<DayOfWeek>> toSchedules(List<HoraireRequest> horaires) {
        Map<LocalTime, Set<DayOfWeek>> byTime = new LinkedHashMap<>();
        for (HoraireRequest horaire : horaires) {
            LocalTime heure = horaire.heure().truncatedTo(ChronoUnit.MINUTES);
            if (byTime.put(heure, JourSemaine.toDaysOfWeek(horaire.jours())) != null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Horaire en double : " + heure + ".");
            }
        }
        return byTime;
    }

    private Medication load(UUID medicationId) {
        return medications.findWithSchedules(medicationId)
                .orElseThrow(() -> BusinessException.notFound("Traitement introuvable."));
    }

    private static MedicationDto toDto(Medication m) {
        List<HoraireDto> horaires = m.activeSchedules().stream()
                .map(s -> new HoraireDto(s.getId(), s.getHeureRappel(), JourSemaine.fromMask(s.getJoursSemaine())))
                .toList();
        return new MedicationDto(m.getId(), m.getSeniorId(), m.getNomMedicament(), m.getConsigne(),
                m.getDateDebut(), m.getDateFin(), m.isActif(), horaires);
    }
}
