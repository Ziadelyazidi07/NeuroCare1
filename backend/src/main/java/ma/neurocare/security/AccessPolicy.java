package ma.neurocare.security;

import java.util.UUID;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.consent.application.ConsentService;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.user.domain.UserRole;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Contrôle d'accès aux données : le rôle ne suffit pas, il faut l'appartenance et le consentement
 * (cahier §8.3). Utilisé via {@code @PreAuthorize("@accessPolicy.xxx(#seniorId, authentication)")}.
 *
 * <ul>
 *   <li>senior inexistant ou non lié à l'appelant → 404 (ne pas révéler son existence) ;</li>
 *   <li>lien présent mais consentement manquant → 403 {@code CONSENT_REQUIRED} ;</li>
 *   <li>rôle inadapté → {@code false} → 403 {@code ACCESS_DENIED}.</li>
 * </ul>
 */
@Component("accessPolicy")
@RequiredArgsConstructor
public class AccessPolicy {

    private final CaregiverLinkService links;
    private final ConsentService consents;

    /** Le senior lui-même, ou un aidant lié (même si la paire n'est pas encore validée). */
    public boolean isSelfOrLinkedCaregiver(UUID seniorId, Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (caller.is(UserRole.SENIOR)) {
            return requireSelf(seniorId, caller);
        }
        if (caller.is(UserRole.AIDANT)) {
            requireLink(seniorId, caller);
            return true;
        }
        return false;
    }

    /** Aidant lié (paramétrage : profil, appairage, appareils). */
    public boolean isLinkedCaregiver(UUID seniorId, Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (!caller.is(UserRole.AIDANT)) {
            return false;
        }
        requireLink(seniorId, caller);
        return true;
    }

    /** Tableau de bord, historique, exercices, PDF : lien validé + PARTAGE_FAMILIAL. */
    public boolean canReadHealthData(UUID seniorId, Authentication authentication) {
        return caregiverWithConsent(seniorId, authentication, ConsentType.PARTAGE_FAMILIAL);
    }

    /** Créer / modifier un traitement : lien validé + RAPPELS. */
    public boolean canManageMedications(UUID seniorId, Authentication authentication) {
        return caregiverWithConsent(seniorId, authentication, ConsentType.RAPPELS);
    }

    /** Lire les traitements : le senior lui-même, ou un aidant habilité à les gérer (lien validé + RAPPELS). */
    public boolean canViewMedications(UUID seniorId, Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (caller.is(UserRole.SENIOR)) {
            return requireSelf(seniorId, caller);
        }
        return caregiverWithConsent(seniorId, authentication, ConsentType.RAPPELS);
    }

    /** Lire les prises d'une journée : le senior lui-même, ou un aidant avec PARTAGE_FAMILIAL. */
    public boolean canReadDoses(UUID seniorId, Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (caller.is(UserRole.SENIOR)) {
            return requireSelf(seniorId, caller);
        }
        return caregiverWithConsent(seniorId, authentication, ConsentType.PARTAGE_FAMILIAL);
    }

    /**
     * Modules de pré-dépistage (SpO2, GDS) : le senior lui-même, ou un aidant avec lien validé +
     * PARTAGE_FAMILIAL (il saisit et lit des données de santé).
     */
    public boolean canUseScreening(UUID seniorId, Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (caller.is(UserRole.SENIOR)) {
            return requireSelf(seniorId, caller);
        }
        return caregiverWithConsent(seniorId, authentication, ConsentType.PARTAGE_FAMILIAL);
    }

    /** Uploader une voix : lien validé + VOIX. */
    public boolean canUploadVoice(UUID seniorId, Authentication authentication) {
        return caregiverWithConsent(seniorId, authentication, ConsentType.VOIX);
    }

    /** Démarrer un exercice : l'appelant est le senior et EXERCICES est accordé. */
    public boolean canDoExercise(Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (!caller.is(UserRole.SENIOR)) {
            return false;
        }
        if (!consents.isGranted(caller.userId(), ConsentType.EXERCICES)) {
            throw BusinessException.consentRequired(ConsentType.EXERCICES.name());
        }
        return true;
    }

    /** Rompre un lien : le senior concerné, ou l'aidant concerné lui-même. */
    public boolean canBreakLink(UUID seniorId, UUID aidantId, Authentication authentication) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (caller.is(UserRole.SENIOR)) {
            return requireSelf(seniorId, caller);
        }
        if (caller.is(UserRole.AIDANT) && caller.userId().equals(aidantId)) {
            requireLink(seniorId, caller);
            return true;
        }
        if (caller.is(UserRole.AIDANT)) {
            requireLink(seniorId, caller);
        }
        return false;
    }

    private boolean caregiverWithConsent(UUID seniorId, Authentication authentication, ConsentType type) {
        AuthenticatedUser caller = CurrentUser.from(authentication);
        if (!caller.is(UserRole.AIDANT)) {
            return false;
        }
        CaregiverLinkView link = requireLink(seniorId, caller);
        if (!link.consentementValide() || !consents.isGranted(seniorId, type)) {
            String missing = link.consentementValide() ? type.name() : ConsentType.PARTAGE_FAMILIAL.name();
            throw BusinessException.consentRequired(missing);
        }
        return true;
    }

    private CaregiverLinkView requireLink(UUID seniorId, AuthenticatedUser caller) {
        return links.findLink(seniorId, caller.userId())
                .orElseThrow(() -> BusinessException.notFound("Senior introuvable."));
    }

    private static boolean requireSelf(UUID seniorId, AuthenticatedUser caller) {
        if (!caller.userId().equals(seniorId)) {
            throw BusinessException.notFound("Senior introuvable.");
        }
        return true;
    }
}
