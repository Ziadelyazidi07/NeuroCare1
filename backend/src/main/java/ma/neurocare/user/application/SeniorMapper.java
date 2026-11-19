package ma.neurocare.user.application;

import ma.neurocare.consent.application.CaregiverLinkView;
import ma.neurocare.user.api.dto.SeniorDto;
import ma.neurocare.user.domain.SeniorProfile;
import ma.neurocare.user.domain.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface SeniorMapper {

    @Mapping(target = "id", source = "user.id")
    @Mapping(target = "nomComplet", source = "user.nomComplet")
    @Mapping(target = "langue", source = "profile.langue")
    @Mapping(target = "fuseau", source = "profile.fuseau")
    @Mapping(target = "taillePolice", source = "profile.taillePolice")
    @Mapping(target = "contrasteEleve", source = "profile.contrasteEleve")
    @Mapping(target = "delaiSansReponseMin", source = "profile.delaiSansReponseMin")
    @Mapping(target = "contactUrgenceNom", source = "profile.contactUrgenceNom")
    @Mapping(target = "contactUrgenceTel", source = "profile.contactUrgenceTel")
    @Mapping(target = "donneesFictives", source = "profile.donneesFictives")
    @Mapping(target = "anneeNaissance", source = "profile.anneeNaissance")
    @Mapping(target = "modeSonRappel", source = "profile.modeSonRappel")
    @Mapping(target = "lien", source = "link")
    SeniorDto toDto(User user, SeniorProfile profile, CaregiverLinkView link);

    SeniorDto.LienDto toLien(CaregiverLinkView link);
}
