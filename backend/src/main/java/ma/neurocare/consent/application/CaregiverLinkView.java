package ma.neurocare.consent.application;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.consent.domain.CaregiverLink;

/** Vue publique d'une paire senior–aidant, exposée aux autres modules. */
public record CaregiverLinkView(
        UUID id,
        UUID seniorId,
        UUID aidantId,
        String lienParente,
        String surnomSenior,
        boolean consentementValide,
        Instant dateConsentement) {

    static CaregiverLinkView of(CaregiverLink link) {
        return new CaregiverLinkView(link.getId(), link.getSeniorId(), link.getAidantId(), link.getLienParente(),
                link.getSurnomSenior(), link.isConsentementValide(), link.getDateConsentement());
    }
}
