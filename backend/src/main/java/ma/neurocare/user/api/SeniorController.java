package ma.neurocare.user.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ma.neurocare.security.CurrentUser;
import ma.neurocare.user.api.dto.CreateSeniorRequest;
import ma.neurocare.user.api.dto.SeniorDto;
import ma.neurocare.user.api.dto.UpdateSeniorRequest;
import ma.neurocare.user.application.SeniorService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Seniors", description = "Profils seniors et préférences")
@RestController
@RequestMapping("/api/v1/seniors")
@RequiredArgsConstructor
public class SeniorController {

    private final SeniorService seniorService;

    @Operation(summary = "Crée un senior et le lien avec l'aidant appelant (consentement non encore validé)")
    @PostMapping
    @PreAuthorize("hasRole('AIDANT')")
    public ResponseEntity<SeniorDto> create(@Valid @RequestBody CreateSeniorRequest request) {
        SeniorDto created = seniorService.create(CurrentUser.get().userId(), request);
        return ResponseEntity.created(URI.create("/api/v1/seniors/" + created.id())).body(created);
    }

    @Operation(summary = "Liste des seniors suivis par l'aidant")
    @GetMapping
    @PreAuthorize("hasRole('AIDANT')")
    public List<SeniorDto> list() {
        return seniorService.listForCaregiver(CurrentUser.get().userId());
    }

    @Operation(summary = "Profil et préférences")
    @GetMapping("/{seniorId}")
    @PreAuthorize("@accessPolicy.isSelfOrLinkedCaregiver(#seniorId, authentication)")
    public SeniorDto get(@PathVariable UUID seniorId) {
        return seniorService.get(seniorId, CurrentUser.get());
    }

    @Operation(summary = "Modifie langue, police, délai, contact d'urgence")
    @PatchMapping("/{seniorId}")
    @PreAuthorize("@accessPolicy.isLinkedCaregiver(#seniorId, authentication)")
    public SeniorDto update(@PathVariable UUID seniorId, @Valid @RequestBody UpdateSeniorRequest request) {
        return seniorService.update(seniorId, request, CurrentUser.get());
    }
}
