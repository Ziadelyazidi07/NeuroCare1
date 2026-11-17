package ma.neurocare.consent.infrastructure;

import java.util.List;
import java.util.UUID;

import ma.neurocare.consent.domain.ConsentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConsentHistoryRepository extends JpaRepository<ConsentHistory, Long> {

    @Query("""
            select h from ConsentHistory h join fetch h.consent c
             where c.seniorId = :seniorId
             order by h.horodatage desc, h.id desc
            """)
    List<ConsentHistory> findAllForSenior(@Param("seniorId") UUID seniorId);
}
