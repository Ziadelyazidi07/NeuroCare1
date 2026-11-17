package ma.neurocare.consent.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * @param accorde                 accord ou révocation
 * @param versionTexte            version de la notice d'information présentée au senior
 * @param presenceSeniorConfirmee obligatoire à {@code true} quand un aidant enregistre le choix
 *                                du senior en sa présence (cahier §7.2)
 */
public record ConsentUpdateRequest(
        @NotNull Boolean accorde,
        @NotBlank @Size(max = 20) String versionTexte,
        Boolean presenceSeniorConfirmee) {
}
