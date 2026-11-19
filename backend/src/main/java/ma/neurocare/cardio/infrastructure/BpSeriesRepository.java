package ma.neurocare.cardio.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.cardio.domain.BpSeries;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BpSeriesRepository extends JpaRepository<BpSeries, UUID> {

    List<BpSeries> findTop10BySeniorIdOrderByCreeLeDesc(UUID seniorId);

    Optional<BpSeries> findByIdAndSeniorId(UUID id, UUID seniorId);
}
