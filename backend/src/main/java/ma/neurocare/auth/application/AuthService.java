package ma.neurocare.auth.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.auth.api.dto.AuthDtos.AuthResponse;
import ma.neurocare.auth.api.dto.AuthDtos.LoginRequest;
import ma.neurocare.auth.api.dto.AuthDtos.RegisterRequest;
import ma.neurocare.auth.api.dto.AuthDtos.UserSummary;
import ma.neurocare.auth.domain.RefreshToken;
import ma.neurocare.auth.infrastructure.RefreshTokenRepository;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.config.NeuroCareProperties;
import ma.neurocare.security.AuthenticatedUser;
import ma.neurocare.security.JwtService;
import ma.neurocare.security.TokenHasher;
import ma.neurocare.user.application.UserAccount;
import ma.neurocare.user.application.UserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inscription, connexion, rotation des refresh tokens et déconnexion (EF-AU-01, 02, 06, 07 ; cahier §8.1).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final RefreshTokenRepository refreshTokens;
    private final JwtService jwtService;
    private final TokenHasher hasher;
    private final NeuroCareProperties properties;
    private final Clock clock;

    @Transactional
    public UserSummary register(RegisterRequest request) {
        UserAccount account = userService.registerAidant(request.nomComplet(), request.telephone(),
                request.motDePasse());
        return toSummary(account);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResponse login(LoginRequest request) {
        UserAccount account = userService.verifyCredentials(request.telephone(), request.motDePasse());
        return issueTokens(account, UUID.randomUUID());
    }

    /**
     * Rotation : le token présenté est révoqué et remplacé. Un token déjà révoqué qui est
     * présenté de nouveau signale un vol probable → toute la famille est révoquée.
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResponse refresh(String rawRefreshToken) {
        RefreshToken token = refreshTokens.findByTokenHash(hasher.sha256(rawRefreshToken))
                .orElseThrow(AuthService::invalidRefreshToken);
        if (token.isRevoque()) {
            int revoked = refreshTokens.revokeFamily(token.getFamilyId());
            log.warn("Réutilisation d'un refresh token révoqué : famille {} révoquée ({} token(s) actifs)",
                    token.getFamilyId(), revoked);
            throw invalidRefreshToken();
        }
        if (token.isExpired(clock.instant())) {
            throw invalidRefreshToken();
        }
        token.revoke();
        UserAccount account = userService.getActiveAccount(token.getUserId());
        return issueTokens(account, token.getFamilyId());
    }

    /** Révoque la session (famille du refresh token) de l'appelant. Idempotent. */
    @Transactional
    public void logout(String rawRefreshToken, AuthenticatedUser caller) {
        refreshTokens.findByTokenHash(hasher.sha256(rawRefreshToken))
                .filter(t -> t.getUserId().equals(caller.userId()))
                .ifPresent(t -> refreshTokens.revokeFamily(t.getFamilyId()));
    }

    private AuthResponse issueTokens(UserAccount account, UUID familyId) {
        Instant now = clock.instant();
        String rawRefresh = hasher.randomToken();
        refreshTokens.save(new RefreshToken(account.id(), familyId, hasher.sha256(rawRefresh), now,
                now.plus(properties.jwt().refreshTtl())));
        String accessToken = jwtService.issueAccessToken(account.id(), account.role());
        return new AuthResponse(accessToken, rawRefresh, jwtService.accessTtlSeconds(), toSummary(account));
    }

    private static UserSummary toSummary(UserAccount account) {
        return new UserSummary(account.id(), account.nomComplet(), account.role());
    }

    private static BusinessException invalidRefreshToken() {
        return new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN, "Refresh token invalide, expiré ou révoqué.");
    }
}
