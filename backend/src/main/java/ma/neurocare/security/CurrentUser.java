package ma.neurocare.security;

import java.util.List;

import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Accès à l'appelant courant.
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static AuthenticatedUser get() {
        return from(SecurityContextHolder.getContext().getAuthentication());
    }

    public static AuthenticatedUser from(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        throw new BusinessException(ErrorCode.UNAUTHENTICATED, "Authentification requise.");
    }

    static Authentication toAuthentication(AuthenticatedUser user) {
        return UsernamePasswordAuthenticationToken.authenticated(user, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name())));
    }
}
