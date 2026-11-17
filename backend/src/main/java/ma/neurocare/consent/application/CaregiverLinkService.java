package ma.neurocare.consent.application;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.consent.domain.CaregiverLink;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.consent.infrastructure.CaregiverLinkRepository;
import ma.neurocare.consent.infrastructure.ConsentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paires senior–aidant (EF-CO-01, EF-CO-06 : un senior peut avoir plusieurs aidants et inversement).
 */
@Service
@RequiredArgsConstructor
public class CaregiverLinkService {

    private final CaregiverLinkRepository links;
    private final ConsentRepository consents;

    /**
     * Crée le lien. Il reste inactif ({@code consentementValide = false}) tant que le senior
     * n'a pas accordé PARTAGE_FAMILIAL.
     */
    @Transactional
    public CaregiverLinkView createLink(UUID seniorId, UUID aidantId, String lienParente, String surnomSenior) {
        CaregiverLink link = new CaregiverLink(seniorId, aidantId, lienParente, surnomSenior);
        return CaregiverLinkView.of(links.save(link));
    }

    @Transactional(readOnly = true)
    public Optional<CaregiverLinkView> findLink(UUID seniorId, UUID aidantId) {
        return links.findBySeniorIdAndAidantId(seniorId, aidantId).map(CaregiverLinkView::of);
    }

    @Transactional(readOnly = true)
    public List<CaregiverLinkView> linksOfCaregiver(UUID aidantId) {
        return links.findByAidantIdOrderByDateCreationAsc(aidantId).stream().map(CaregiverLinkView::of).toList();
    }

    /** Lien existant + paire validée par le senior + consentement {@code type} accordé. */
    @Transactional(readOnly = true)
    public boolean hasActiveLinkWithConsent(UUID seniorId, UUID aidantId, ConsentType type) {
        return links.findBySeniorIdAndAidantId(seniorId, aidantId)
                .filter(CaregiverLink::isConsentementValide)
                .isPresent()
                && consents.existsBySeniorIdAndTypeAndAccordeTrue(seniorId, type);
    }

    /** Rompt le lien (DELETE /seniors/{seniorId}/caregivers/{aidantId}). */
    @Transactional
    public void deleteLink(UUID seniorId, UUID aidantId) {
        CaregiverLink link = links.findBySeniorIdAndAidantId(seniorId, aidantId)
                .orElseThrow(() -> BusinessException.notFound("Lien senior–aidant introuvable."));
        links.delete(link);
    }
}
