package ma.neurocare.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.consent.application.ConsentService;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

/** Cahier §8.3 : lien + consentement, 404 pour un senior non lié, 403 CONSENT_REQUIRED sinon. */
class AccessPolicyTest {

    private final CaregiverLinkService links = mock(CaregiverLinkService.class);
    private final ConsentService consents = mock(ConsentService.class);
    private final AccessPolicy policy = new AccessPolicy(links, consents);

    private final UUID seniorId = UUID.randomUUID();
    private final UUID aidantId = UUID.randomUUID();
    private final Authentication aidant = CurrentUser.toAuthentication(AuthenticatedUser.ofJwt(aidantId, UserRole.AIDANT));

    @Test
    void unlinkedCaregiverGetsNotFound() {
        when(links.findLink(seniorId, aidantId)).thenReturn(Optional.empty());

        assertCode(() -> policy.canReadHealthData(seniorId, aidant), ErrorCode.RESOURCE_NOT_FOUND);
        assertCode(() -> policy.isLinkedCaregiver(seniorId, aidant), ErrorCode.RESOURCE_NOT_FOUND);
    }

    @Test
    void linkNotValidatedRequiresFamilySharing() {
        linked(false);
        when(consents.isGranted(seniorId, ConsentType.RAPPELS)).thenReturn(true);

        assertThatThrownBy(() -> policy.canManageMedications(seniorId, aidant))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("PARTAGE_FAMILIAL");
    }

    @Test
    void revokedFamilySharingBlocksHealthData() {
        linked(true);
        when(consents.isGranted(seniorId, ConsentType.PARTAGE_FAMILIAL)).thenReturn(false);

        assertCode(() -> policy.canReadHealthData(seniorId, aidant), ErrorCode.CONSENT_REQUIRED);
    }

    @Test
    void eachOperationChecksItsOwnConsent() {
        linked(true);
        when(consents.isGranted(seniorId, ConsentType.PARTAGE_FAMILIAL)).thenReturn(true);
        when(consents.isGranted(seniorId, ConsentType.RAPPELS)).thenReturn(true);
        when(consents.isGranted(seniorId, ConsentType.VOIX)).thenReturn(false);

        assertThat(policy.canReadHealthData(seniorId, aidant)).isTrue();
        assertThat(policy.canManageMedications(seniorId, aidant)).isTrue();
        assertThatThrownBy(() -> policy.canUploadVoice(seniorId, aidant))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("VOIX");
    }

    @Test
    void seniorOnlyReachesHisOwnData() {
        Authentication senior = CurrentUser.toAuthentication(AuthenticatedUser.ofDevice(seniorId, UUID.randomUUID()));

        assertThat(policy.isSelfOrLinkedCaregiver(seniorId, senior)).isTrue();
        assertCode(() -> policy.isSelfOrLinkedCaregiver(UUID.randomUUID(), senior), ErrorCode.RESOURCE_NOT_FOUND);
        assertThat(policy.isLinkedCaregiver(seniorId, senior)).isFalse();
        assertThat(policy.canReadHealthData(seniorId, senior)).isFalse();
    }

    @Test
    void exerciseRequiresSeniorAndExercisesConsent() {
        Authentication senior = CurrentUser.toAuthentication(AuthenticatedUser.ofDevice(seniorId, UUID.randomUUID()));
        when(consents.isGranted(seniorId, ConsentType.EXERCICES)).thenReturn(false);

        assertCode(() -> policy.canDoExercise(senior), ErrorCode.CONSENT_REQUIRED);
        assertThat(policy.canDoExercise(aidant)).isFalse();
    }

    @Test
    void onlyConcernedPartiesCanBreakLink() {
        linked(true);
        UUID otherAidant = UUID.randomUUID();

        assertThat(policy.canBreakLink(seniorId, aidantId, aidant)).isTrue();
        assertThat(policy.canBreakLink(seniorId, otherAidant, aidant)).isFalse();
    }

    private void linked(boolean valide) {
        when(links.findLink(seniorId, aidantId)).thenReturn(Optional.of(
                new CaregiverLinkView(UUID.randomUUID(), seniorId, aidantId, "fille", "Baba", valide, null)));
    }

    private static void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, ErrorCode code) {
        assertThatThrownBy(call)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).code())
                .isEqualTo(code);
    }
}
