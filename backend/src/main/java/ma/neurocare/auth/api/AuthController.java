package ma.neurocare.auth.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.auth.api.dto.AuthDtos.AuthResponse;
import ma.neurocare.auth.api.dto.AuthDtos.LoginRequest;
import ma.neurocare.auth.api.dto.AuthDtos.LogoutRequest;
import ma.neurocare.auth.api.dto.AuthDtos.PairingRedeemRequest;
import ma.neurocare.auth.api.dto.AuthDtos.PairingRedeemResponse;
import ma.neurocare.auth.api.dto.AuthDtos.RefreshRequest;
import ma.neurocare.auth.api.dto.AuthDtos.RegisterRequest;
import ma.neurocare.auth.api.dto.AuthDtos.UserSummary;
import ma.neurocare.auth.application.AuthService;
import ma.neurocare.auth.application.PairingService;
import ma.neurocare.security.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Authentification", description = "Comptes aidants, JWT et appairage du téléphone senior")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PairingService pairingService;

    @Operation(summary = "Création d'un compte AIDANT")
    @PostMapping("/register")
    public ResponseEntity<UserSummary> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @Operation(summary = "Connexion, renvoie accessToken + refreshToken")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Rotation du refresh token")
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @Operation(summary = "Révoque le refresh token (AIDANT, MEDECIN)")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken(), CurrentUser.get());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Échange d'un code d'appairage contre un token d'appareil SENIOR")
    @PostMapping("/pairing/redeem")
    public PairingRedeemResponse redeem(@Valid @RequestBody PairingRedeemRequest request,
                                        HttpServletRequest httpRequest) {
        return pairingService.redeem(request, httpRequest.getRemoteAddr());
    }
}
