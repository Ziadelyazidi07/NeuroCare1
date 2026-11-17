package ma.neurocare.reminder.application;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.reminder.api.dto.DoseDtos.OfflineConfirmation;
import ma.neurocare.reminder.api.dto.DoseDtos.SyncItemResult;
import ma.neurocare.reminder.api.dto.DoseDtos.SyncResponse;
import ma.neurocare.reminder.api.dto.DoseDtos.SyncResult;
import ma.neurocare.reminder.application.DoseService.ConfirmationResult;
import org.springframework.stereotype.Service;

/**
 * Envoi groupé des confirmations faites hors ligne (EF-RE-06, cahier §9.5). Chaque élément est
 * traité de façon idempotente et isolée : un refus n'empêche pas les autres d'être appliqués.
 */
@Service
@RequiredArgsConstructor
public class DoseSyncService {

    private final DoseService doseService;

    public SyncResponse sync(UUID seniorId, List<OfflineConfirmation> confirmations) {
        List<SyncItemResult> results = new ArrayList<>(confirmations.size());
        for (OfflineConfirmation c : confirmations) {
            results.add(apply(seniorId, c));
        }
        return new SyncResponse(results);
    }

    private SyncItemResult apply(UUID seniorId, OfflineConfirmation c) {
        try {
            ConfirmationResult result = doseService.confirmIsolated(c.doseId(), seniorId, c.clientRequestId(),
                    c.horodatageClient());
            SyncResult status = switch (result.outcome()) {
                case ALREADY_APPLIED -> SyncResult.DEJA_APPLIQUEE;
                default -> SyncResult.APPLIQUEE;
            };
            return new SyncItemResult(c.doseId(), c.clientRequestId(), status, result.dose().statut());
        } catch (BusinessException e) {
            if (e.code() == ErrorCode.RESOURCE_NOT_FOUND) {
                return new SyncItemResult(c.doseId(), c.clientRequestId(), SyncResult.INTROUVABLE, null);
            }
            return new SyncItemResult(c.doseId(), c.clientRequestId(), SyncResult.REFUSEE,
                    doseService.get(c.doseId(), seniorId).statut());
        }
    }
}
