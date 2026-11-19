package ma.neurocare.user.api.dto;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.common.domain.Language;
import ma.neurocare.user.domain.ReminderSoundMode;

/**
 * Profil d'un senior. {@code lien} décrit la paire avec l'aidant appelant (nul si l'appelant est le senior).
 */
public record SeniorDto(
        UUID id,
        String nomComplet,
        Language langue,
        String fuseau,
        short taillePolice,
        boolean contrasteEleve,
        short delaiSansReponseMin,
        String contactUrgenceNom,
        String contactUrgenceTel,
        boolean donneesFictives,
        Short anneeNaissance,
        ReminderSoundMode modeSonRappel,
        LienDto lien) {

    public record LienDto(String lienParente, String surnomSenior, boolean consentementValide,
                          Instant dateConsentement) {
    }
}
