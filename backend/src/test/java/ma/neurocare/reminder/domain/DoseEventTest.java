package ma.neurocare.reminder.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

/** Règle d'intégrité §6.5 : une prise ne quitte EN_ATTENTE qu'une seule fois. */
class DoseEventTest {

    private final DoseEvent dose = new DoseEvent(UUID.randomUUID(), UUID.randomUUID(),
            Instant.parse("2026-11-17T08:00:00Z"));

    @Test
    void newDoseIsPending() {
        assertThat(dose.getStatut()).isEqualTo(DoseStatus.EN_ATTENTE);
    }

    @Test
    void confirmSetsStatusAndTimestamp() {
        Instant at = Instant.parse("2026-11-17T08:03:12Z");
        dose.confirm(at, "key-1");

        assertThat(dose.getStatut()).isEqualTo(DoseStatus.CONFIRME);
        assertThat(dose.getHorodatageAction()).isEqualTo(at);
        assertThat(dose.getClientRequestId()).isEqualTo("key-1");
    }

    @Test
    void finalStatusRejectsAnyFurtherTransition() {
        dose.markNoResponse();

        assertThatThrownBy(() -> dose.confirm(Instant.now(), "late"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).code())
                .isEqualTo(ErrorCode.INVALID_STATUS_TRANSITION);
        assertThatThrownBy(dose::deactivate).isInstanceOf(BusinessException.class);
        assertThat(dose.getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);
    }
}
