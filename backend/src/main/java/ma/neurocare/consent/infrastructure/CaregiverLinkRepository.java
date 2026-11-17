package ma.neurocare.consent.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.consent.domain.CaregiverLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CaregiverLinkRepository extends JpaRepository<CaregiverLink, UUID> {

    Optional<CaregiverLink> findBySeniorIdAndAidantId(UUID seniorId, UUID aidantId);

    List<CaregiverLink> findByAidantIdOrderByDateCreationAsc(UUID aidantId);

    List<CaregiverLink> findBySeniorId(UUID seniorId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update CaregiverLink l
               set l.consentementValide = :valide, l.dateConsentement = :date
             where l.seniorId = :seniorId
            """)
    int updateFamilySharing(@Param("seniorId") UUID seniorId, @Param("valide") boolean valide,
                            @Param("date") Instant date);
}
