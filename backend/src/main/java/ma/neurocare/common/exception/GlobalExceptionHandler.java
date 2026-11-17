package ma.neurocare.common.exception;

import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Convertit toutes les erreurs en RFC 7807 avec un code métier (cahier §5.3).
 * Les messages ne contiennent jamais de données de santé ni de numéro de téléphone.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    ProblemDetail handleBusiness(BusinessException ex, HttpServletRequest request) {
        return ProblemDetails.of(ex.code(), ex.getMessage(), request.getRequestURI());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetails.of(ErrorCode.VALIDATION_ERROR,
                "Un ou plusieurs paramètres sont invalides.", request.getRequestURI());
        problem.setProperty("errors", ex.getConstraintViolations().stream()
                .map(v -> Map.of("field", v.getPropertyPath().toString(), "message", v.getMessage()))
                .toList());
        return problem;
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return ProblemDetails.of(ErrorCode.ACCESS_DENIED, "Accès refusé.", request.getRequestURI());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail handleOptimisticLock(ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        return ProblemDetails.of(ErrorCode.CONFLICT,
                "La ressource a été modifiée simultanément, réessayez.", request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Erreur non gérée sur {}", request.getRequestURI(), ex);
        return ProblemDetails.of(ErrorCode.INTERNAL_ERROR, "Une erreur inattendue est survenue.",
                request.getRequestURI());
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetails.of(ErrorCode.VALIDATION_ERROR,
                "Un ou plusieurs champs sont invalides.", uri(request));
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of("field", fe.getField(),
                        "message", fe.getDefaultMessage() == null ? "invalide" : fe.getDefaultMessage()))
                .toList();
        problem.setProperty("errors", errors);
        return ResponseEntity.status(problem.getStatus()).body(problem);
    }

    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetails.of(ErrorCode.PAYLOAD_TOO_LARGE,
                "Le fichier dépasse la taille maximale autorisée (5 Mo).", uri(request));
        return ResponseEntity.status(problem.getStatus()).body(problem);
    }

    /** Ajoute le code métier aux erreurs MVC standard (404 de route, 405, JSON illisible…). */
    @Override
    protected ResponseEntity<Object> createResponseEntity(Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problem && problem.getProperties() == null) {
            ErrorCode code = switch (statusCode.value()) {
                case 400 -> ErrorCode.VALIDATION_ERROR;
                case 404 -> ErrorCode.RESOURCE_NOT_FOUND;
                case 409 -> ErrorCode.CONFLICT;
                case 413 -> ErrorCode.PAYLOAD_TOO_LARGE;
                default -> null;
            };
            if (code != null) {
                problem.setProperty(ProblemDetails.CODE_PROPERTY, code.name());
            }
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    private static String uri(WebRequest request) {
        return request instanceof ServletWebRequest swr ? swr.getRequest().getRequestURI() : null;
    }
}
