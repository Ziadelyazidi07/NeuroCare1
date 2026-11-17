package ma.neurocare.user.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.user.domain.User;
import ma.neurocare.user.domain.UserRole;
import ma.neurocare.user.infrastructure.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Comptes utilisateurs : création d'aidant, vérification des identifiants avec blocage
 * temporaire après 5 échecs (EF-AU-06).
 */
@Service
public class UserService {

    static final int MAX_FAILED_LOGINS = 5;
    static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    /** Empreinte BCrypt réelle mais inutilisée : égalise le temps de réponse quand le téléphone est inconnu. */
    private final String dummyHash;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public UserAccount registerAidant(String nomComplet, String telephone, String rawPassword) {
        if (users.existsByTelephone(telephone)) {
            throw new BusinessException(ErrorCode.PHONE_ALREADY_USED, "Ce numéro de téléphone est déjà utilisé.");
        }
        User user = new User(nomComplet.strip(), telephone, passwordEncoder.encode(rawPassword), UserRole.AIDANT);
        return UserAccount.of(users.save(user));
    }

    /**
     * Vérifie téléphone + mot de passe. Les échecs sont comptés même si l'appel lève une exception
     * (pas de rollback sur {@link BusinessException}).
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public UserAccount verifyCredentials(String telephone, String rawPassword) {
        Instant now = clock.instant();
        User user = users.findByTelephone(telephone).orElse(null);
        if (user == null || user.getPasswordHash() == null || !user.isActif()) {
            passwordEncoder.matches(rawPassword, dummyHash);
            throw invalidCredentials();
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw new BusinessException(ErrorCode.TOO_MANY_ATTEMPTS,
                    "Compte temporairement bloqué après plusieurs échecs. Réessayez plus tard.");
        }
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            int failures = user.getFailedLogins() + 1;
            if (failures >= MAX_FAILED_LOGINS) {
                user.setLockedUntil(now.plus(LOCK_DURATION));
                user.setFailedLogins((short) 0);
            } else {
                user.setFailedLogins((short) failures);
            }
            throw invalidCredentials();
        }
        if (user.getFailedLogins() != 0 || user.getLockedUntil() != null) {
            user.setFailedLogins((short) 0);
            user.setLockedUntil(null);
        }
        return UserAccount.of(user);
    }

    @Transactional(readOnly = true)
    public UserAccount getActiveAccount(UUID userId) {
        return users.findById(userId)
                .filter(User::isActif)
                .map(UserAccount::of)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHENTICATED, "Compte introuvable ou inactif."));
    }

    private static BusinessException invalidCredentials() {
        return new BusinessException(ErrorCode.INVALID_CREDENTIALS, "Téléphone ou mot de passe incorrect.");
    }
}
