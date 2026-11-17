package ma.neurocare.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;

final class BearerTokens {

    private static final String PREFIX = "Bearer ";

    private BearerTokens() {
    }

    static String extract(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, PREFIX, 0, PREFIX.length())) {
            return null;
        }
        String token = header.substring(PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }
}
