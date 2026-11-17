package ma.neurocare.auth.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.auth.api.dto.AuthDtos.PairingCodeResponse;
import ma.neurocare.auth.api.dto.AuthDtos.PairingRedeemRequest;
import ma.neurocare.auth.api.dto.AuthDtos.PairingRedeemResponse;
import ma.neurocare.auth.domain.PairingCode;
import ma.neurocare.auth.infrastructure.PairingCodeRepository;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.notification.application.DeviceService;
import ma.neurocare.security.AttemptLimiter;
import ma.neurocare.security.TokenHasher;
import ma.neurocare.user.application.SeniorService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Appairage du téléphone senior : code à 6 chiffres, 10 min, usage unique, échangé contre un
 * token d'appareil opaque longue durée (EF-AU-04, cahier §8.1). 5 échecs / 15 min par adresse IP.
 */
@Service
@RequiredArgsConstructor
public class PairingService {

    static final Duration CODE_TTL = Duration.ofMinutes(10);
    private static final int MAX_GENERATION_ATTEMPTS = 10;

    private final PairingCodeRepository codes;
    private final DeviceService deviceService;
    private final SeniorService seniorService;
    private final TokenHasher hasher;
    private final AttemptLimiter limiter;
    private final Clock clock;

    @Transactional
    public PairingCodeResponse generate(UUID seniorId) {
        Instant now = clock.instant();
        codes.invalidateActive(seniorId);
        for (int i = 0; i < MAX_GENERATION_ATTEMPTS; i++) {
            String code = hasher.randomSixDigitCode();
            String hash = hasher.hmac(code);
            // Évite qu'un même code soit actif pour deux seniors en même temps.
            if (!codes.existsByCodeHashAndUtiliseFalseAndExpireLeAfter(hash, now)) {
                PairingCode saved = codes.save(new PairingCode(seniorId, hash, now.plus(CODE_TTL)));
                return new PairingCodeResponse(code, saved.getExpireLe());
            }
        }
        throw new IllegalStateException("Impossible de générer un code d'appairage unique");
    }

    @Transactional
    public PairingRedeemResponse redeem(PairingRedeemRequest request, String clientIp) {
        String limiterKey = "pairing:" + clientIp;
        if (limiter.isBlocked(limiterKey)) {
            throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS,
                    "Trop de tentatives d'appairage. Réessayez dans quelques minutes.");
        }
        PairingCode pairing = codes.findFirstByCodeHashAndUtiliseFalseAndExpireLeAfter(
                        hasher.hmac(request.code()), clock.instant())
                .orElse(null);
        if (pairing == null) {
            limiter.recordFailure(limiterKey);
            throw new BusinessException(ErrorCode.PAIRING_CODE_INVALID,
                    "Code d'appairage incorrect, expiré ou déjà utilisé.");
        }
        pairing.consume();
        limiter.reset(limiterKey);

        String deviceToken = hasher.newDeviceToken();
        deviceService.registerSeniorDevice(pairing.getSeniorId(), request.plateforme(), hasher.sha256(deviceToken));
        return new PairingRedeemResponse(deviceToken, pairing.getSeniorId(),
                seniorService.displayName(pairing.getSeniorId()));
    }
}
