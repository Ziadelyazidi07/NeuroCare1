package ma.neurocare.common.exception;

import java.net.URI;

import org.springframework.http.ProblemDetail;

/**
 * Fabrique de {@link ProblemDetail} au format NeuroCare (cahier §7.8) :
 * {@code type}, {@code title}, {@code status}, {@code code}, {@code detail}, {@code instance}.
 */
public final class ProblemDetails {

    public static final String TYPE_BASE = "https://neurocare.ma/errors/";
    public static final String CODE_PROPERTY = "code";

    private ProblemDetails() {
    }

    public static ProblemDetail of(ErrorCode code, String detail, String instance) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(code.status(), detail);
        problem.setType(URI.create(TYPE_BASE + code.slug()));
        problem.setTitle(code.title());
        problem.setProperty(CODE_PROPERTY, code.name());
        if (instance != null) {
            problem.setInstance(URI.create(instance));
        }
        return problem;
    }
}
