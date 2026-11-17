package ma.neurocare.voice.application;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.consent.application.ConsentService;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.voice.domain.VoiceProfile;
import ma.neurocare.voice.domain.VoiceProfileStatus;
import ma.neurocare.voice.infrastructure.VoiceProfileRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Recherche des profils vocaux d'un senior (un profil est rattaché à une paire senior–aidant). */
@Component
@RequiredArgsConstructor
public class VoiceProfileFinder {

    private final VoiceProfileRepository profiles;
    private final CaregiverLinkService linkService;
    private final ConsentService consentService;

    @Transactional(readOnly = true)
    public List<VoiceProfile> profilesOfSenior(UUID seniorId) {
        List<UUID> linkIds = linkService.linksOfSenior(seniorId).stream().map(CaregiverLinkView::id).toList();
        return linkIds.isEmpty() ? List.of() : profiles.findByCaregiverLinkIdInOrderByDateCreationDesc(linkIds);
    }

    @Transactional(readOnly = true)
    public Optional<VoiceProfile> latest(UUID seniorId) {
        return profilesOfSenior(seniorId).stream().findFirst();
    }

    /** Voix utilisable pour le niveau 1 : profil PRET et consentement VOIX accordé. */
    @Transactional(readOnly = true)
    public Optional<VoiceProfile> usableVoice(UUID seniorId) {
        if (!consentService.isGranted(seniorId, ConsentType.VOIX)) {
            return Optional.empty();
        }
        return latest(seniorId)
                .filter(p -> p.getStatut() == VoiceProfileStatus.PRET && p.getProviderVoiceId() != null);
    }
}
