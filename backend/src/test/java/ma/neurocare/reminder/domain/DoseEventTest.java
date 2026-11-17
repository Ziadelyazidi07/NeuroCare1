package ma.neurocare.reminder.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Transitions de statut d'une prise (cahier §6.5 et §9.1). */
class DoseEventTest {

    private static final Instant PREVUE = Instant.parse("2026-11-17T08:00:00Z");
    private static final Duration TIMEOUT = Duration.ofMinutes(30);
    private static final Instant CLOSED_AT = PREVUE.plus(TIMEOUT);

    private final DoseEvent dose = new DoseEvent(UUID.randomUUID(), UUID.randomUUID(), PREVUE);

    @Test
    void newDoseIsPendingAndNotNotified() {
        assertThat(dose.getStatut()).isEqualTo(DoseStatus.EN_ATTENTE);
        assertThat(dose.isNotificationEnvoyee()).isFalse();
        assertThat(dose.isRelanceEnvoyee()).isFalse();
    }

    @Nested
    class FromPending {

        @Test
        void confirmUsesClientTimestamp() {
            Instant client = PREVUE.plusSeconds(192);
            ConfirmationOutcome outcome = dose.confirm("k1", client, PREVUE.plusSeconds(200), TIMEOUT);

            assertThat(outcome).isEqualTo(ConfirmationOutcome.APPLIED);
            assertThat(dose.getStatut()).isEqualTo(DoseStatus.CONFIRME);
            assertThat(dose.getHorodatageAction()).isEqualTo(client);
            assertThat(dose.getClientRequestId()).isEqualTo("k1");
        }

        @Test
        void confirmWithoutClientTimestampUsesServerTime() {
            Instant now = PREVUE.plusSeconds(60);
            dose.confirm(null, null, now, TIMEOUT);

            assertThat(dose.getHorodatageAction()).isEqualTo(now);
            assertThat(dose.getClientRequestId()).isNull();
        }

        @Test
        void clientTimestampInTheFutureIsClampedToServerTime() {
            Instant now = PREVUE.plusSeconds(60);
            dose.confirm("k1", now.plusSeconds(3600), now, TIMEOUT);

            assertThat(dose.getHorodatageAction()).isEqualTo(now);
        }

        @Test
        void noResponseThenDeactivateIsRefused() {
            dose.markNoResponse();

            assertThat(dose.getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);
            assertInvalidTransition(dose::deactivate);
            assertInvalidTransition(dose::markNoResponse);
        }

        @Test
        void deactivatedDoseNeverBecomesNoResponse() {
            dose.deactivate();

            assertThat(dose.getStatut()).isEqualTo(DoseStatus.DESACTIVE);
            assertInvalidTransition(dose::markNoResponse);
        }
    }

    @Nested
    class Idempotence {

        @Test
        void replayWithSameKeyIsAlreadyAppliedWithoutChange() {
            Instant first = PREVUE.plusSeconds(100);
            dose.confirm("same-key", first, first, TIMEOUT);
            int versionBefore = dose.getVersion();

            ConfirmationOutcome replay = dose.confirm("same-key", PREVUE.plusSeconds(500), PREVUE.plusSeconds(500),
                    TIMEOUT);

            assertThat(replay).isEqualTo(ConfirmationOutcome.ALREADY_APPLIED);
            assertThat(dose.getHorodatageAction()).isEqualTo(first);
            assertThat(dose.getVersion()).isEqualTo(versionBefore);
        }

        @Test
        void secondConfirmationWithAnotherKeyIsRejected() {
            dose.confirm("k1", null, PREVUE, TIMEOUT);

            assertThat(dose.confirm("k2", null, PREVUE.plusSeconds(10), TIMEOUT))
                    .isEqualTo(ConfirmationOutcome.REJECTED_FINAL);
            assertThat(dose.confirm(null, null, PREVUE.plusSeconds(10), TIMEOUT))
                    .isEqualTo(ConfirmationOutcome.REJECTED_FINAL);
            assertThat(dose.getClientRequestId()).isEqualTo("k1");
        }
    }

    @Nested
    class AfterClosure {

        @Test
        void offlineConfirmationMadeBeforeClosureIsAccepted() {
            dose.markNoResponse();
            Instant madeOffline = CLOSED_AT.minusSeconds(60);

            ConfirmationOutcome outcome = dose.confirm("offline-1", madeOffline, CLOSED_AT.plusSeconds(3600), TIMEOUT);

            assertThat(outcome).isEqualTo(ConfirmationOutcome.APPLIED_LATE);
            assertThat(dose.getStatut()).isEqualTo(DoseStatus.CONFIRME);
            assertThat(dose.getHorodatageAction()).isEqualTo(madeOffline);
        }

        @Test
        void confirmationMadeAfterClosureIsRejectedAndDoseStaysNoResponse() {
            dose.markNoResponse();

            ConfirmationOutcome outcome = dose.confirm("late", CLOSED_AT.plusSeconds(1), CLOSED_AT.plusSeconds(60),
                    TIMEOUT);

            assertThat(outcome).isEqualTo(ConfirmationOutcome.REJECTED_AFTER_CLOSURE);
            assertThat(dose.getStatut()).isEqualTo(DoseStatus.SANS_REPONSE);
            assertThat(dose.getHorodatageAction()).isNull();
        }

        @Test
        void onlineConfirmationWithoutClientTimestampAfterClosureIsRejected() {
            dose.markNoResponse();

            assertThat(dose.confirm("k", null, CLOSED_AT.plusSeconds(5), TIMEOUT))
                    .isEqualTo(ConfirmationOutcome.REJECTED_AFTER_CLOSURE);
        }

        @Test
        void deactivatedDoseRejectsConfirmation() {
            dose.deactivate();

            assertThat(dose.confirm("k", PREVUE, PREVUE, TIMEOUT)).isEqualTo(ConfirmationOutcome.REJECTED_FINAL);
            assertThat(dose.getStatut()).isEqualTo(DoseStatus.DESACTIVE);
        }
    }

    private static void assertInvalidTransition(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).code())
                .isEqualTo(ErrorCode.INVALID_STATUS_TRANSITION);
    }
}
