package ma.neurocare.user.application;

import java.util.UUID;

import ma.neurocare.user.domain.User;
import ma.neurocare.user.domain.UserRole;

/** Vue publique d'un compte, exposée aux autres modules (jamais l'entité). */
public record UserAccount(UUID id, String nomComplet, UserRole role) {

    static UserAccount of(User user) {
        return new UserAccount(user.getId(), user.getNomComplet(), user.getRole());
    }
}
