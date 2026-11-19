package ma.neurocare.cardio.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.cardio.domain.BpMeasurement;
import ma.neurocare.cardio.domain.MeasureMoment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BpMeasurementRepository extends JpaRepository<BpMeasurement, UUID> {

    List<BpMeasurement> findBySerieIdIn(Collection<UUID> serieIds);

    Optional<BpMeasurement> findBySerieIdAndJourAndMomentAndRang(UUID serieId, Short jour, MeasureMoment moment, Short rang);

    List<BpMeasurement> findBySeniorIdAndSerieIdIsNullAndDateMesureGreaterThanEqualOrderByDateMesureDesc(
            UUID seniorId, Instant from);
}
