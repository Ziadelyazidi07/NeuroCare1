package ma.neurocare.audit.application;

import java.util.UUID;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ma.neurocare.security.CurrentUser;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

/**
 * Aspect AOP d'audit (cahier §5.2 {@code AuditAspect}) : après chaque lecture réussie d'une méthode
 * {@link AuditHealthRead}, enregistre l'acteur, l'action et le senior concerné.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    static final String SENIOR_PARAMETER = "seniorId";

    private final AuditService auditService;

    @AfterReturning("@annotation(audited)")
    public void auditRead(JoinPoint joinPoint, AuditHealthRead audited) {
        UUID seniorId = seniorIdOf(joinPoint);
        try {
            auditService.record(CurrentUser.get().userId(), audited.value(), "SENIOR", seniorId);
        } catch (RuntimeException e) {
            // L'audit ne doit jamais casser la lecture, mais son échec doit être visible.
            log.error("Audit {} non enregistré : {}", audited.value(), e.getClass().getSimpleName());
        }
    }

    private static UUID seniorIdOf(JoinPoint joinPoint) {
        String[] names = ((MethodSignature) joinPoint.getSignature()).getParameterNames();
        Object[] args = joinPoint.getArgs();
        for (int i = 0; i < names.length; i++) {
            if (SENIOR_PARAMETER.equals(names[i]) && args[i] instanceof UUID id) {
                return id;
            }
        }
        return null;
    }
}
