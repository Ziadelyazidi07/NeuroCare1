package ma.neurocare.common.exception;

/**
 * Exception métier convertie en {@code ProblemDetail} par {@link GlobalExceptionHandler}.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode code;

    public BusinessException(ErrorCode code, String detail) {
        super(detail);
        this.code = code;
    }

    public ErrorCode code() {
        return code;
    }

    public static BusinessException notFound(String detail) {
        return new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, detail);
    }

    public static BusinessException consentRequired(String consentType) {
        return new BusinessException(ErrorCode.CONSENT_REQUIRED,
                "Le consentement " + consentType + " n'est pas accordé.");
    }

    public static BusinessException invalidTransition(String detail) {
        return new BusinessException(ErrorCode.INVALID_STATUS_TRANSITION, detail);
    }
}
