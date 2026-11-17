package ma.neurocare.audit.application;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Trace dans {@code audit_logs} chaque lecture réussie de données de santé (cahier §8.4, §13.2).
 * La méthode annotée doit avoir un paramètre {@code UUID seniorId}.
 */
@Documented
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditHealthRead {

    /** Action enregistrée, ex. READ_DASHBOARD. */
    String value();
}
