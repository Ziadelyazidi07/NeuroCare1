package ma.neurocare.auth.api.dto;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ma.neurocare.common.validation.Patterns;
import ma.neurocare.notification.domain.Platform;
import ma.neurocare.user.domain.UserRole;

/** DTO du module AUTH (cahier §7.1 et §7.8). */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Size(max = 120) String nomComplet,
            @NotBlank @Pattern(regexp = Patterns.E164, message = "doit être au format E.164") String telephone,
            @NotBlank @Size(min = 8, max = 72, message = "doit contenir entre 8 et 72 caractères")
            String motDePasse) {
    }

    public record LoginRequest(
            @NotBlank @Pattern(regexp = Patterns.E164, message = "doit être au format E.164") String telephone,
            @NotBlank @Size(max = 72) String motDePasse) {
    }

    public record RefreshRequest(@NotBlank @Size(max = 128) String refreshToken) {
    }

    public record LogoutRequest(@NotBlank @Size(max = 128) String refreshToken) {
    }

    public record UserSummary(UUID id, String nomComplet, UserRole role) {
    }

    public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UserSummary user) {
    }

    public record PairingCodeResponse(String code, Instant expireLe) {
    }

    public record PairingRedeemRequest(
            @NotBlank @Pattern(regexp = "^\\d{6}$", message = "doit contenir 6 chiffres") String code,
            @NotNull Platform plateforme) {
    }

    public record PairingRedeemResponse(String deviceToken, UUID seniorId, String nomComplet) {
    }
}
