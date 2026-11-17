package ma.neurocare.security;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authentifie les JWT des aidants / médecins. Les tokens d'appareil ({@code ncd_…}) sont laissés
 * au {@link DeviceTokenFilter}. Un token invalide laisse la requête anonyme (→ 401 si la route est protégée).
 *
 * <p>Instancié dans {@code SecurityConfig} (pas de {@code @Component}) pour ne pas être enregistré
 * une seconde fois comme filtre servlet.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = BearerTokens.extract(request);
        if (token != null && !token.startsWith(TokenHasher.DEVICE_TOKEN_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            jwtService.parse(token).ifPresent(user ->
                    SecurityContextHolder.getContext().setAuthentication(CurrentUser.toAuthentication(user)));
        }
        chain.doFilter(request, response);
    }
}
