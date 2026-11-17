package ma.neurocare.audit.application;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ma.neurocare.audit.domain.AuditLog;
import ma.neurocare.audit.infrastructure.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Journal d'audit (table {@code audit_logs}). Écrit dans sa propre transaction pour être conservé
 * même si l'opération auditée échoue ensuite.
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogs;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(UUID actorId, String action, String cibleType, UUID cibleId) {
        auditLogs.save(new AuditLog(actorId, action, cibleType, cibleId, currentIp()));
    }

    private static String currentIp() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            return request.getRemoteAddr();
        }
        return null;
    }
}
