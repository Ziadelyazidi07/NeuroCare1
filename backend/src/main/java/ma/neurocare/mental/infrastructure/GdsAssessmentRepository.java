package ma.neurocare.mental.infrastructure;

import java.util.List;
import java.util.UUID;

import ma.neurocare.mental.domain.GdsAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GdsAssessmentRepository extends JpaRepository<GdsAssessment, UUID> {

    List<GdsAssessment> findTop50BySeniorIdOrderByDatePassationDesc(UUID seniorId);
}
