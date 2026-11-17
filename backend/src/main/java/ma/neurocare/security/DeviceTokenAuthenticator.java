package ma.neurocare.security;

import java.util.Optional;

/**
 * Résout l'empreinte d'un token d'appareil en principal SENIOR.
 * Implémenté par le module {@code notification} (propriétaire de la table {@code devices}).
 */
public interface DeviceTokenAuthenticator {

    Optional<AuthenticatedUser> authenticate(String deviceTokenHash);
}
