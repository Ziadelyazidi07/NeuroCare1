package ma.neurocare.consent.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.consent.api.dto.ConsentDto;
import ma.neurocare.consent.api.dto.ConsentHistoryDto;
import ma.neurocare.consent.api.dto.ConsentUpdateRequest;
import ma.neurocare.consent.domain.Consent;
import ma.neurocare.consent.domain.ConsentChannel;
import ma.neurocare.consent.domain.ConsentHistory;
import ma.neurocare.consent.domain.ConsentType;
import ma.neurocare.consent.infrastructure.CaregiverLinkRepository;
import ma.neurocare.consent.infrastructure.ConsentHistoryRepository;
import ma.neurocare.consent.infrastructure.ConsentRepository;
import ma.neurocare.security.AuthenticatedUser;
import ma.neurocare.user.domain.UserRole;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quatre consentements indépendants, historisés et révocables (EF-CO-02 à EF-CO-04).
 * L'autorisation (senior lui-même ou aidant lié) est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class ConsentService {

    private final ConsentRepository consents;
    private final ConsentHistoryRepository history;
    private final CaregiverLinkRepository links;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<ConsentDto> list(UUID seniorId) {
        Map<ConsentType, Consent> byType = consents.findBySeniorId(seniorId).stream()
                .collect(Collectors.toMap(Consent::getType, Function.identity()));
        return Arrays.stream(ConsentType.values())
                .map(type -> {
                    Consent c = byType.get(type);
                    return c == null
                            ? new ConsentDto(type, false, null, null)
                            : new ConsentDto(type, c.isAccorde(), c.getVersionTexte(), c.getDateMaj());
                })
                .toList();
    }

    @Transactional
    public ConsentDto update(UUID seniorId, ConsentType type, ConsentUpdateRequest request, AuthenticatedUser caller) {
        ConsentChannel canal = channelFor(caller, request);
        Instant now = clock.instant();
        boolean accorde = request.accorde();

        Consent consent = consents.findBySeniorIdAndType(seniorId, type)
                .orElseGet(() -> new Consent(seniorId, type, accorde, request.versionTexte()));
        consent.setAccorde(accorde);
        consent.setVersionTexte(request.versionTexte());
        consent.setDateMaj(now);
        consent = consents.save(consent);
        history.save(new ConsentHistory(consent, accorde, request.versionTexte(), caller.userId(), canal));

        if (type == ConsentType.PARTAGE_FAMILIAL) {
            // EF-CO-01 / EF-CO-04 : la paire n'est active qu'avec ce consentement ; la révocation coupe l'accès.
            links.updateFamilySharing(seniorId, accorde, accorde ? now : null);
        }
        events.publishEvent(new ConsentChangedEvent(seniorId, type, accorde, caller.userId()));
        return new ConsentDto(type, accorde, consent.getVersionTexte(), now);
    }

    @Transactional(readOnly = true)
    public List<ConsentHistoryDto> history(UUID seniorId) {
        return history.findAllForSenior(seniorId).stream()
                .map(h -> new ConsentHistoryDto(h.getConsent().getType(), h.isAccorde(),
                        h.getVersionTexte(), h.getAuteurId(), h.getCanal(), h.getHorodatage()))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isGranted(UUID seniorId, ConsentType type) {
        return consents.existsBySeniorIdAndTypeAndAccordeTrue(seniorId, type);
    }

    /** Parmi {@code seniorIds}, ceux qui ont accordé {@code type}. */
    @Transactional(readOnly = true)
    public Set<UUID> seniorsWithConsent(Collection<UUID> seniorIds, ConsentType type) {
        return seniorIds.isEmpty() ? Set.of() : consents.findGrantedSeniorIds(type, seniorIds);
    }

    private static ConsentChannel channelFor(AuthenticatedUser caller, ConsentUpdateRequest request) {
        if (caller.is(UserRole.SENIOR)) {
            return ConsentChannel.APP_SENIOR;
        }
        if (!Boolean.TRUE.equals(request.presenceSeniorConfirmee())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Un aidant ne peut enregistrer un consentement qu'en présence du senior "
                            + "(presenceSeniorConfirmee = true).");
        }
        return ConsentChannel.APP_AIDANT;
    }
}
