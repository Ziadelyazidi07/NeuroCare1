package ma.neurocare.dashboard.api;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.dashboard.api.dto.DashboardDtos.HistoryDto;
import ma.neurocare.dashboard.api.dto.DashboardDtos.TodayDto;
import ma.neurocare.dashboard.application.DashboardQueryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Tableau de bord", description = "Vue descriptive pour l'aidant — aucun diagnostic")
@Validated
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardQueryService dashboard;

    @Operation(summary = "Pastilles du jour + dernier exercice (AIDANT lié + PARTAGE_FAMILIAL)")
    @GetMapping("/today")
    @PreAuthorize("@accessPolicy.canReadHealthData(#seniorId, authentication)")
    @AuditHealthRead("READ_DASHBOARD")
    public TodayDto today(@PathVariable UUID seniorId) {
        return dashboard.today(seniorId);
    }

    @Operation(summary = "Taux de confirmation par jour (7 ou 30 jours) et courbe brute des exercices")
    @GetMapping("/history")
    @PreAuthorize("@accessPolicy.canReadHealthData(#seniorId, authentication)")
    @AuditHealthRead("READ_HISTORY")
    public HistoryDto history(@PathVariable UUID seniorId,
                              @RequestParam(defaultValue = "7") @Min(1) @Max(30) int days) {
        return dashboard.history(seniorId, days);
    }
}
