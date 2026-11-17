package ma.neurocare.medication.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import ma.neurocare.medication.domain.Medication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MedicationRepository extends JpaRepository<Medication, UUID> {

    @Query("""
            select distinct m from Medication m left join fetch m.horaires
             where m.seniorId = :seniorId and m.actif = true
             order by m.nomMedicament
            """)
    List<Medication> findActiveWithSchedules(@Param("seniorId") UUID seniorId);

    @Query("select m from Medication m left join fetch m.horaires where m.id = :id")
    Optional<Medication> findWithSchedules(@Param("id") UUID id);

    @Query("select m.seniorId from Medication m where m.id = :id")
    Optional<UUID> findSeniorId(@Param("id") UUID id);
}
