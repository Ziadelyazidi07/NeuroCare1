package ma.neurocare.cardio.api;

import java.net.URI;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.application.AuditHealthRead;
import ma.neurocare.cardio.api.dto.CardioDtos.HistoryDto;
import ma.neurocare.cardio.api.dto.CardioDtos.MeasurementDto;
import ma.neurocare.cardio.api.dto.CardioDtos.MeasurementRequest;
import ma.neurocare.cardio.api.dto.CardioDtos.SeriesDto;
import ma.neurocare.cardio.api.dto.CardioDtos.SeriesListDto;
import ma.neurocare.cardio.api.dto.CardioDtos.SeriesRequest;
import ma.neurocare.cardio.application.CardioService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Cardio-vasculaire (tension)", description = "Pré-dépistage et automesure tensionnelle, sans diagnostic")
@RestController
@RequestMapping("/api/v1/seniors/{seniorId}/bp")
@RequiredArgsConstructor
public class CardioController {

    private final CardioService cardioService;

    @Operation(summary = "Enregistre une mesure (ponctuelle ou créneau du protocole) et renvoie son niveau d'alerte")
    @PostMapping("/measurements")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    public ResponseEntity<MeasurementDto> record(@PathVariable UUID seniorId, @Valid @RequestBody MeasurementRequest request) {
        MeasurementDto saved = cardioService.record(seniorId, CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/v1/seniors/" + seniorId + "/bp/measurements/" + saved.id()))
                .body(saved);
    }

    @Operation(summary = "Mesures ponctuelles des 90 derniers jours, la plus récente en premier")
    @GetMapping("/measurements")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    @AuditHealthRead("READ_BP_MEASUREMENTS")
    public HistoryDto history(@PathVariable UUID seniorId) {
        return cardioService.history(seniorId);
    }

    @Operation(summary = "Démarre un protocole d'automesure sur 3 jours")
    @PostMapping("/series")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    public ResponseEntity<SeriesDto> startSeries(@PathVariable UUID seniorId, @Valid @RequestBody SeriesRequest request) {
        SeriesDto created = cardioService.startSeries(seniorId, request.dateDebut());
        return ResponseEntity.created(URI.create("/api/v1/seniors/" + seniorId + "/bp/series/" + created.id()))
                .body(created);
    }

    @Operation(summary = "Protocoles d'automesure (10 derniers) avec leurs mesures et la moyenne")
    @GetMapping("/series")
    @PreAuthorize("@accessPolicy.canUseScreening(#seniorId, authentication)")
    @AuditHealthRead("READ_BP_SERIES")
    public SeriesListDto series(@PathVariable UUID seniorId) {
        return cardioService.series(seniorId);
    }
}
