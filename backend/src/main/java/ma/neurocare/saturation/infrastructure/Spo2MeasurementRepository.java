package ma.neurocare.saturation.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import ma.neurocare.saturation.domain.Spo2Measurement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface Spo2MeasurementRepository extends JpaRepository<Spo2Measurement, UUID> {

    List<Spo2Measurement> findBySeniorIdAndDateMesureGreaterThanEqualOrderByDateMesureDesc(UUID seniorId, Instant from);
}
