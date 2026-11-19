package ma.neurocare.metabolic.infrastructure;

import java.util.List;
import java.util.UUID;

import ma.neurocare.metabolic.domain.FindriscAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FindriscAssessmentRepository extends JpaRepository<FindriscAssessment, UUID> {

    List<FindriscAssessment> findTop50BySeniorIdOrderByDatePassationDesc(UUID seniorId);
}
