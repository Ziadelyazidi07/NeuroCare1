package ma.neurocare.user.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ma.neurocare.common.domain.Language;
import ma.neurocare.common.validation.Patterns;

/**
 * Création d'un senior par un aidant (EF-AU-03). Pas de date de naissance (minimisation, cahier §13.2).
 * Les champs facultatifs prennent les valeurs par défaut du schéma.
 */
public record CreateSeniorRequest(
        @NotBlank @Size(max = 120) String nomComplet,
        Language langue,
        @Min(16) @Max(48) Short taillePolice,
        Boolean contrasteEleve,
        @Min(1) @Max(240) Short delaiSansReponseMin,
        @Size(max = 120) String contactUrgenceNom,
        @Pattern(regexp = Patterns.E164, message = "doit être au format E.164") String contactUrgenceTel,
        @Size(max = 40) String lienParente,
        @Size(max = 60) String surnomSenior,
        Boolean donneesFictives) {
}
