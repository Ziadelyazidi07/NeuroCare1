package ma.neurocare.audit.infrastructure;

import java.util.List;
import java.util.UUID;

import ma.neurocare.audit.domain.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByCibleIdOrderByHorodatageDesc(UUID cibleId);
}
