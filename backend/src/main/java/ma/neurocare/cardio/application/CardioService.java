package ma.neurocare.cardio.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import ma.neurocare.cardio.api.dto.CardioDtos;
import ma.neurocare.cardio.api.dto.CardioDtos.HistoryDto;
import ma.neurocare.cardio.api.dto.CardioDtos.MeasurementDto;
import ma.neurocare.cardio.api.dto.CardioDtos.MeasurementRequest;
import ma.neurocare.cardio.api.dto.CardioDtos.SeriesDto;
import ma.neurocare.cardio.api.dto.CardioDtos.SeriesListDto;
import ma.neurocare.cardio.domain.BpAverage;
import ma.neurocare.cardio.domain.BpMeasurement;
import ma.neurocare.cardio.domain.BpMeasurement.Slot;
import ma.neurocare.cardio.domain.BpSeries;
import ma.neurocare.cardio.infrastructure.BpMeasurementRepository;
import ma.neurocare.cardio.infrastructure.BpSeriesRepository;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Module 5 (tension) : mesures ponctuelles et protocole d'automesure sur 3 jours. L'autorisation (le
 * senior lui-même ou un aidant lié avec PARTAGE_FAMILIAL) est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class CardioService {

    static final Duration MAX_OFFLINE_DELAY = Duration.ofDays(7);
    static final Duration HISTORY = Duration.ofDays(90);

    private final BpSeriesRepository series;
    private final BpMeasurementRepository measurements;
    private final Clock clock;

    @Transactional
    public SeriesDto startSeries(UUID seniorId, LocalDate dateDebut) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (dateDebut.isAfter(today.plusDays(1)) || dateDebut.isBefore(today.minusDays(7))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date de début du protocole invalide.");
        }
        return toDto(series.save(new BpSeries(seniorId, dateDebut, clock.instant())), List.of());
    }

    @Transactional
    public MeasurementDto record(UUID seniorId, UUID actorId, MeasurementRequest r) {
        Slot slot = slot(seniorId, r);
        if (slot != null) {
            // Ressaisir un créneau remplace la mesure précédente (correction d'une erreur de frappe).
            measurements.findBySerieIdAndJourAndMomentAndRang(slot.serieId(), (short) slot.jour(), slot.moment(),
                    (short) slot.rang()).ifPresent(previous -> {
                        measurements.delete(previous);
                        measurements.flush();
                    });
        }
        try {
            return toDto(measurements.save(new BpMeasurement(seniorId, measureDate(r.dateMesure()), r.tas(), r.tad(),
                    r.pouls(), slot, actorId)));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, e.getMessage() + ".");
        }
    }

    @Transactional(readOnly = true)
    public SeriesListDto series(UUID seniorId) {
        List<BpSeries> list = series.findTop10BySeniorIdOrderByCreeLeDesc(seniorId);
        Map<UUID, List<BpMeasurement>> bySeries = measurements.findBySerieIdIn(list.stream().map(BpSeries::getId).toList())
                .stream().collect(Collectors.groupingBy(BpMeasurement::getSerieId));
        return new SeriesListDto(CardioDtos.AVERTISSEMENT,
                list.stream().map(s -> toDto(s, bySeries.getOrDefault(s.getId(), List.of()))).toList());
    }

    @Transactional(readOnly = true)
    public HistoryDto history(UUID seniorId) {
        return new HistoryDto(CardioDtos.AVERTISSEMENT, measurements
                .findBySeniorIdAndSerieIdIsNullAndDateMesureGreaterThanEqualOrderByDateMesureDesc(seniorId,
                        clock.instant().minus(HISTORY))
                .stream().map(CardioService::toDto).toList());
    }

    private Slot slot(UUID seniorId, MeasurementRequest r) {
        boolean any = r.serieId() != null || r.jour() != null || r.moment() != null || r.rang() != null;
        if (!any) {
            return null;
        }
        if (r.serieId() == null || r.jour() == null || r.moment() == null || r.rang() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Une mesure du protocole précise la série, le jour, le moment et le rang.");
        }
        series.findByIdAndSeniorId(r.serieId(), seniorId)
                .orElseThrow(() -> BusinessException.notFound("Protocole d'automesure introuvable."));
        return new Slot(r.serieId(), r.jour(), r.moment(), r.rang());
    }

    private Instant measureDate(Instant requested) {
        Instant now = clock.instant();
        if (requested == null) {
            return now;
        }
        if (requested.isAfter(now.plusSeconds(60)) || requested.isBefore(now.minus(MAX_OFFLINE_DELAY))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Date de mesure invalide.");
        }
        return requested;
    }

    private static final Comparator<BpMeasurement> SLOT_ORDER = Comparator
            .comparing(BpMeasurement::getJour)
            .thenComparing(BpMeasurement::getMoment)
            .thenComparing(BpMeasurement::getRang);

    static SeriesDto toDto(BpSeries s, List<BpMeasurement> list) {
        BpAverage avg = BpAverage.of(list);
        return new SeriesDto(s.getId(), s.getDateDebut(), s.getCreeLe(),
                list.stream().sorted(SLOT_ORDER).map(CardioService::toDto).toList(), avg.count(), avg.complete(),
                avg.tas(), avg.tad(), avg.pouls(), avg.elevated(), CardioDtos.AVERTISSEMENT);
    }

    static MeasurementDto toDto(BpMeasurement m) {
        return new MeasurementDto(m.getId(), m.getDateMesure(), m.getTas(), m.getTad(), m.getPouls(), m.getNiveau(),
                m.getSerieId(), m.getJour() == null ? null : m.getJour().intValue(), m.getMoment(),
                m.getRang() == null ? null : m.getRang().intValue());
    }
}
