package ma.neurocare.reminder.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.neurocare.reminder.domain.DoseStatus;

/** DTO du module REMIND (cahier §7.4 et §7.8). */
public final class DoseDtos {

    private DoseDtos() {
    }

    public record DoseDto(
            UUID id,
            UUID medicationId,
            String nomMedicament,
            String consigne,
            Instant datePrevue,
            DoseStatus statut,
            Instant horodatageAction) {
    }

    /** Corps facultatif de POST /doses/{id}/confirm. */
    public record ConfirmRequest(Instant horodatageClient) {
    }

    /** Une confirmation faite hors ligne. */
    public record OfflineConfirmation(
            @NotNull UUID doseId,
            @NotBlank @Size(max = 64) String clientRequestId,
            @NotNull Instant horodatageClient) {
    }

    public record SyncRequest(@NotEmpty @Size(max = 100) List<@Valid @NotNull OfflineConfirmation> confirmations) {
    }

    public enum SyncResult {
        APPLIQUEE,
        DEJA_APPLIQUEE,
        REFUSEE,
        INTROUVABLE
    }

    public record SyncItemResult(UUID doseId, String clientRequestId, SyncResult resultat, DoseStatus statut) {
    }

    public record SyncResponse(List<SyncItemResult> resultats) {
    }
}
