package ma.neurocare.report.api;

import java.time.LocalDate;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.report.application.WeeklyReport;
import ma.neurocare.report.application.WeeklyReportService;
import ma.neurocare.report.infrastructure.PdfRenderer;
import ma.neurocare.security.CurrentUser;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Rapports", description = "Rapport hebdomadaire PDF pour le médecin — document descriptif")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/reports")
@RequiredArgsConstructor
public class ReportController {

    private final WeeklyReportService reportService;
    private final PdfRenderer renderer;

    @Operation(summary = "Rapport PDF de la semaine (AIDANT lié + PARTAGE_FAMILIAL) — tracé EXPORT_PDF",
            description = "Généré à la demande, jamais stocké côté serveur.")
    @GetMapping(path = "/weekly", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("@accessPolicy.canReadHealthData(#seniorId, authentication)")
    @AuditHealthRead("EXPORT_PDF")
    public ResponseEntity<byte[]> weekly(
            @PathVariable UUID seniorId,
            @Parameter(description = "Lundi de la semaine, ex. 2026-11-16")
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @Parameter(description = "Observations libres de l'aidant (1000 caractères au plus)")
            @RequestParam(required = false) String observations) {
        WeeklyReport report = reportService.build(seniorId, weekStart, observations, CurrentUser.get().userId());
        byte[] pdf = renderer.render(report);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(WeeklyReportService.fileName(report)).build().toString())
                .cacheControl(CacheControl.noStore())
                .body(pdf);
    }
}
