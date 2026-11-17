package ma.neurocare.user.application;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.security.AuthenticatedUser;
import ma.neurocare.user.api.dto.CreateSeniorRequest;
import ma.neurocare.user.api.dto.SeniorDto;
import ma.neurocare.user.api.dto.UpdateSeniorRequest;
import ma.neurocare.user.domain.SeniorProfile;
import ma.neurocare.user.domain.User;
import ma.neurocare.user.domain.UserRole;
import ma.neurocare.user.infrastructure.SeniorProfileRepository;
import ma.neurocare.user.infrastructure.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Profils seniors créés et paramétrés par un aidant (EF-AU-03).
 * L'autorisation est vérifiée en amont par {@code AccessPolicy}.
 */
@Service
@RequiredArgsConstructor
public class SeniorService {

    private final UserRepository users;
    private final SeniorProfileRepository profiles;
    private final CaregiverLinkService linkService;
    private final SeniorMapper mapper;

    /** Crée le compte senior (sans mot de passe), son profil et le lien avec l'aidant (non encore validé). */
    @Transactional
    public SeniorDto create(UUID aidantId, CreateSeniorRequest request) {
        User senior = users.save(new User(request.nomComplet().strip(), null, null, UserRole.SENIOR));

        SeniorProfile profile = new SeniorProfile(senior.getId());
        if (request.langue() != null) {
            profile.setLangue(request.langue());
        }
        if (request.taillePolice() != null) {
            profile.setTaillePolice(request.taillePolice());
        }
        if (request.contrasteEleve() != null) {
            profile.setContrasteEleve(request.contrasteEleve());
        }
        if (request.delaiSansReponseMin() != null) {
            profile.setDelaiSansReponseMin(request.delaiSansReponseMin());
        }
        profile.setContactUrgenceNom(request.contactUrgenceNom());
        profile.setContactUrgenceTel(request.contactUrgenceTel());
        profile.setDonneesFictives(Boolean.TRUE.equals(request.donneesFictives()));
        profiles.save(profile);

        CaregiverLinkView link = linkService.createLink(senior.getId(), aidantId,
                request.lienParente(), request.surnomSenior());
        return mapper.toDto(senior, profile, link);
    }

    @Transactional(readOnly = true)
    public List<SeniorDto> listForCaregiver(UUID aidantId) {
        List<CaregiverLinkView> links = linkService.linksOfCaregiver(aidantId);
        List<UUID> ids = links.stream().map(CaregiverLinkView::seniorId).toList();
        Map<UUID, User> usersById = users.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, SeniorProfile> profilesById = profiles.findAllById(ids).stream()
                .collect(Collectors.toMap(SeniorProfile::getId, Function.identity()));
        return links.stream()
                .filter(l -> usersById.containsKey(l.seniorId()) && profilesById.containsKey(l.seniorId()))
                .map(l -> mapper.toDto(usersById.get(l.seniorId()), profilesById.get(l.seniorId()), l))
                .toList();
    }

    @Transactional(readOnly = true)
    public SeniorDto get(UUID seniorId, AuthenticatedUser caller) {
        return mapper.toDto(loadUser(seniorId), loadProfile(seniorId), linkFor(seniorId, caller));
    }

    @Transactional
    public SeniorDto update(UUID seniorId, UpdateSeniorRequest request, AuthenticatedUser caller) {
        User senior = loadUser(seniorId);
        SeniorProfile profile = loadProfile(seniorId);
        if (request.nomComplet() != null) {
            senior.setNomComplet(request.nomComplet().strip());
        }
        if (request.langue() != null) {
            profile.setLangue(request.langue());
        }
        if (request.taillePolice() != null) {
            profile.setTaillePolice(request.taillePolice());
        }
        if (request.contrasteEleve() != null) {
            profile.setContrasteEleve(request.contrasteEleve());
        }
        if (request.delaiSansReponseMin() != null) {
            profile.setDelaiSansReponseMin(request.delaiSansReponseMin());
        }
        if (request.contactUrgenceNom() != null) {
            profile.setContactUrgenceNom(request.contactUrgenceNom());
        }
        if (request.contactUrgenceTel() != null) {
            profile.setContactUrgenceTel(request.contactUrgenceTel());
        }
        return mapper.toDto(senior, profile, linkFor(seniorId, caller));
    }

    /** Pour les autres modules : nom affiché du senior. */
    @Transactional(readOnly = true)
    public String displayName(UUID seniorId) {
        return loadUser(seniorId).getNomComplet();
    }

    private CaregiverLinkView linkFor(UUID seniorId, AuthenticatedUser caller) {
        return caller.is(UserRole.AIDANT) ? linkService.findLink(seniorId, caller.userId()).orElse(null) : null;
    }

    private User loadUser(UUID seniorId) {
        return users.findById(seniorId)
                .filter(u -> u.getRole() == UserRole.SENIOR)
                .orElseThrow(() -> BusinessException.notFound("Senior introuvable."));
    }

    private SeniorProfile loadProfile(UUID seniorId) {
        return profiles.findById(seniorId).orElseThrow(() -> BusinessException.notFound("Senior introuvable."));
    }
}
