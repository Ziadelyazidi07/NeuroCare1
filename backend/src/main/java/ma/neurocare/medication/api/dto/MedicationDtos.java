package ma.neurocare.medication.api.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.neurocare.medication.domain.JourSemaine;

/**
 * DTO du module MED (cahier §7.3 et §7.8). Aucun champ de posologie (EF-ME-03).
 */
public final class MedicationDtos {

    private MedicationDtos() {
    }

    public record HoraireRequest(
            @NotNull LocalTime heure,
            @NotEmpty Set<@NotNull JourSemaine> jours) {
    }

    /** Création (POST) et remplacement complet (PUT). */
    public record MedicationRequest(
            @NotBlank @Size(max = 120) String nomMedicament,
            @Size(max = 255) String consigne,
            @NotNull LocalDate dateDebut,
            LocalDate dateFin,
            @NotEmpty @Size(max = 12) List<@Valid @NotNull HoraireRequest> horaires) {
    }

    public record HoraireDto(UUID id, LocalTime heure, List<JourSemaine> jours) {
    }

    public record MedicationDto(
            UUID id,
            UUID seniorId,
            String nomMedicament,
            String consigne,
            LocalDate dateDebut,
            LocalDate dateFin,
            boolean actif,
            List<HoraireDto> horaires) {
    }
}
