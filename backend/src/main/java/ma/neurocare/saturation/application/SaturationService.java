package ma.neurocare.saturation.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.saturation.api.dto.SaturationDtos;
import ma.neurocare.saturation.api.dto.SaturationDtos.HistoryDto;
import ma.neurocare.saturation.api.dto.SaturationDtos.MeasurementDto;
import ma.neurocare.saturation.api.dto.SaturationDtos.MeasurementRequest;
import ma.neurocare.saturation.api.dto.SaturationDtos.ProfileDto;
import ma.neurocare.saturation.domain.Spo2Measurement;
import ma.neurocare.saturation.domain.Spo2Profile;
import ma.neurocare.saturation.infrastructure.Spo2MeasurementRepository;
import ma.neurocare.saturation.infrastructure.Spo2ProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Module 2 (SpO2) : profil respiratoire et mesures au repos. L'autorisation (le senior lui-même ou un
 * aidant lié avec PARTAGE_FAMILIAL) est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class SaturationService {

    /** Une mesure faite hors ligne peut être envoyée plus tard, dans cette limite. */
    static final Duration MAX_OFFLINE_DELAY = Duration.ofDays(7);
    static final Duration HISTORY = Duration.ofDays(90);

    private final Spo2ProfileRepository profiles;
    private final Spo2MeasurementRepository measurements;
    private final Clock clock;

    @Transactional(readOnly = true)
    public ProfileDto profile(UUID seniorId) {
        return profiles.findById(seniorId)
                .map(p -> new ProfileDto(p.isMaladieRespiratoireChronique(), p.getMisAJourLe()))
                .orElse(new ProfileDto(null, null));
    }

    @Transactional
    public ProfileDto updateProfile(UUID seniorId, boolean chronic) {
        Instant now = clock.instant();
        Spo2Profile profile = profiles.findById(seniorId)
                .map(p -> {
                    p.update(chronic, now);
                    return p;
                })
                .orElseGet(() -> profiles.save(new Spo2Profile(seniorId, chronic, now)));
        return new ProfileDto(profile.isMaladieRespiratoireChronique(), profile.getMisAJourLe());
    }

    @Transactional
    public MeasurementDto record(UUID seniorId, UUID actorId, MeasurementRequest request) {
        Spo2Profile profile = profiles.findById(seniorId).orElseThrow(() -> new BusinessException(
                ErrorCode.VALIDATION_ERROR, "Renseignez d'abord le profil respiratoire du patient."));
        Spo2Measurement saved = measurements.save(new Spo2Measurement(seniorId, measureDate(request.dateMesure()),
                request.spo2(), request.pouls(), profile.isMaladieRespiratoireChronique(), actorId));
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public HistoryDto history(UUID seniorId) {
        return new HistoryDto(SaturationDtos.AVERTISSEMENT, measurements
                .findBySeniorIdAndDateMesureGreaterThanEqualOrderByDateMesureDesc(seniorId, clock.instant().minus(HISTORY))
                .stream().map(SaturationService::toDto).toList());
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

    static MeasurementDto toDto(Spo2Measurement m) {
        return new MeasurementDto(m.getId(), m.getDateMesure(), m.getSpo2(), m.getPouls(),
                m.isMaladieRespiratoireChronique(), m.getNiveau());
    }
}
