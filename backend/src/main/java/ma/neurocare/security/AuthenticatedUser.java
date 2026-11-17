package ma.neurocare.security;

import java.util.UUID;

import ma.neurocare.user.domain.UserRole;

/**
 * Principal placé dans le {@code SecurityContext}.
 *
 * @param userId   identifiant de l'utilisateur (le senior pour un token d'appareil)
 * @param role     rôle applicatif
 * @param deviceId appareil authentifié (token d'appareil senior), sinon {@code null}
 */
public record AuthenticatedUser(UUID userId, UserRole role, UUID deviceId) {

    public static AuthenticatedUser ofJwt(UUID userId, UserRole role) {
        return new AuthenticatedUser(userId, role, null);
    }

    public static AuthenticatedUser ofDevice(UUID seniorId, UUID deviceId) {
        return new AuthenticatedUser(seniorId, UserRole.SENIOR, deviceId);
    }

    public boolean is(UserRole expected) {
        return role == expected;
    }
}
