package ma.neurocare.auth.api;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import ma.neurocare.auth.api.dto.AuthDtos.PairingCodeResponse;
import ma.neurocare.auth.application.PairingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Authentification")
@RestController
@RequiredArgsConstructor
public class PairingCodeController {

    private final PairingService pairingService;

    @Operation(summary = "Génère un code d'appairage (10 min) ; invalide les codes précédents")
    @PostMapping("/api/v1/seniors/{seniorId}/pairing-codes")
    @PreAuthorize("@accessPolicy.isLinkedCaregiver(#seniorId, authentication)")
    public ResponseEntity<PairingCodeResponse> generate(@PathVariable UUID seniorId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pairingService.generate(seniorId));
    }
}
