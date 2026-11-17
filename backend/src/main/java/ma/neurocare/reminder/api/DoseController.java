package ma.neurocare.reminder.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.reminder.api.dto.DoseDtos.ConfirmRequest;
import ma.neurocare.reminder.api.dto.DoseDtos.DoseDto;
import ma.neurocare.reminder.api.dto.DoseDtos.SyncRequest;
import ma.neurocare.reminder.api.dto.DoseDtos.SyncResponse;
import ma.neurocare.reminder.application.DoseService;
import ma.neurocare.reminder.application.DoseSyncService;
import ma.neurocare.security.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Prises et rappels", description = "« C'est fait » confirme le rappel, ce n'est pas une preuve de prise")
@Validated
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DoseController {

    private final DoseService doseService;
    private final DoseSyncService syncService;

    @Operation(summary = "Prises d'une journée (AIDANT lié + PARTAGE_FAMILIAL, ou SENIOR)")
    @GetMapping("/seniors/{seniorId}/doses")
    @PreAuthorize("@accessPolicy.canReadDoses(#seniorId, authentication)")
    @AuditHealthRead("READ_DOSES")
    public List<DoseDto> dosesOfDay(@PathVariable UUID seniorId,
                                    @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return doseService.dosesOfDay(seniorId, date);
    }

    @Operation(summary = "Écran principal du senior : prises du jour")
    @GetMapping("/me/doses/today")
    public List<DoseDto> today() {
        return doseService.today(CurrentUser.get().userId());
    }

    @Operation(summary = "Prises des prochaines heures, pour les notifications locales hors ligne")
    @GetMapping("/me/doses/upcoming")
    public List<DoseDto> upcoming(@RequestParam(defaultValue = "48") @Min(1) @Max(72) int hours) {
        return doseService.upcoming(CurrentUser.get().userId(), hours);
    }

    @Operation(summary = "« C'est fait » — idempotent avec l'en-tête Idempotency-Key")
    @PostMapping("/doses/{doseId}/confirm")
    @PreAuthorize("hasRole('SENIOR')")
    public DoseDto confirm(@PathVariable UUID doseId,
                           @Parameter(description = "Clé unique générée par le téléphone (UUID recommandé)")
                           @RequestHeader(name = "Idempotency-Key", required = false) @Size(max = 64) String key,
                           @RequestBody(required = false) ConfirmRequest body) {
        return doseService.confirm(doseId, CurrentUser.get().userId(), key,
                body == null ? null : body.horodatageClient()).dose();
    }

    @Operation(summary = "Envoi groupé des confirmations faites hors ligne")
    @PostMapping("/me/doses/sync")
    public SyncResponse sync(@Valid @RequestBody SyncRequest request) {
        return syncService.sync(CurrentUser.get().userId(), request.confirmations());
    }
}
