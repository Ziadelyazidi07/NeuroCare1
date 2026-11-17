package ma.neurocare.user.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ma.neurocare.common.domain.Language;
import ma.neurocare.common.validation.Patterns;

/** Mise à jour partielle (PATCH) : seuls les champs non nuls sont appliqués. */
public record UpdateSeniorRequest(
        @Size(min = 1, max = 120) String nomComplet,
        Language langue,
        @Min(16) @Max(48) Short taillePolice,
        Boolean contrasteEleve,
        @Min(1) @Max(240) Short delaiSansReponseMin,
        @Size(max = 120) String contactUrgenceNom,
        @Pattern(regexp = Patterns.E164, message = "doit être au format E.164") String contactUrgenceTel,
        @Min(1900) @Max(2100) Short anneeNaissance) {
}
