package ma.neurocare.security;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Convertit un token d'appareil senior ({@code Authorization: Bearer ncd_…}) en authentification
 * de rôle SENIOR (cahier §8.1). Un token inconnu ou révoqué laisse la requête anonyme.
 */
public class DeviceTokenFilter extends OncePerRequestFilter {

    private final DeviceTokenAuthenticator authenticator;
    private final TokenHasher hasher;

    public DeviceTokenFilter(DeviceTokenAuthenticator authenticator, TokenHasher hasher) {
        this.authenticator = authenticator;
        this.hasher = hasher;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = BearerTokens.extract(request);
        if (token != null && token.startsWith(TokenHasher.DEVICE_TOKEN_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            authenticator.authenticate(hasher.sha256(token)).ifPresent(user ->
                    SecurityContextHolder.getContext().setAuthentication(CurrentUser.toAuthentication(user)));
        }
        chain.doFilter(request, response);
    }
}
