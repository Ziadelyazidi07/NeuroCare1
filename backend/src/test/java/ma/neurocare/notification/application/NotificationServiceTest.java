package ma.neurocare.notification.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import ma.neurocare.consent.application.CaregiverLinkService;
import ma.neurocare.notification.application.PushNotificationService.PushMessage;
import ma.neurocare.notification.application.PushNotificationService.PushResult;
import ma.neurocare.reminder.application.ReminderEvents.DoseReminderDue;
import ma.neurocare.reminder.application.ReminderEvents.DoseStatusChanged;
import ma.neurocare.reminder.domain.DoseStatus;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class NotificationServiceTest {

    private final PushNotificationService push = mock(PushNotificationService.class);
    private final DeviceService devices = mock(DeviceService.class);
    private final CaregiverLinkService links = mock(CaregiverLinkService.class);
    private final NotificationService service = new NotificationService(push, devices, links);

    private final UUID seniorId = UUID.randomUUID();
    private final UUID doseId = UUID.randomUUID();
    private final Instant prevue = Instant.parse("2026-11-17T07:00:00Z");

    @Test
    void reminderIsSentAsDataMessageToEachSeniorDevice() {
        when(devices.activeFcmTokens(seniorId)).thenReturn(List.of("tok-a", "tok-b"));
        when(push.send(any(), any())).thenReturn(PushResult.SENT);

        service.onDoseReminderDue(new DoseReminderDue(doseId, seniorId, "Metformine 500", prevue, false));

        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(push).send(eq("tok-a"), message.capture());
        verify(push).send(eq("tok-b"), any());
        assertThat(message.getValue().type()).isEqualTo(NotificationService.DOSE_REMINDER);
        assertThat(message.getValue().data())
                .containsEntry("doseId", doseId.toString())
                .containsEntry("medication", "Metformine 500")
                .containsEntry("relance", "false");
    }

    @Test
    void invalidTokenIsForgotten() {
        when(devices.activeFcmTokens(seniorId)).thenReturn(List.of("stale"));
        when(push.send(eq("stale"), any())).thenReturn(PushResult.INVALID_TOKEN);

        service.onDoseReminderDue(new DoseReminderDue(doseId, seniorId, "X", prevue, true));

        verify(devices).forgetFcmToken("stale");
    }

    @Test
    void noResponseAlertGoesOnlyToAuthorizedCaregiversWithoutHealthDetails() {
        UUID aidant = UUID.randomUUID();
        when(links.caregiversWithHealthAccess(seniorId)).thenReturn(List.of(aidant));
        when(devices.activeFcmTokens(aidant)).thenReturn(List.of("aidant-token"));
        when(push.send(any(), any())).thenReturn(PushResult.SENT);

        service.onDoseStatusChanged(new DoseStatusChanged(doseId, seniorId, "Metformine 500", prevue,
                DoseStatus.SANS_REPONSE));

        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(push).send(eq("aidant-token"), message.capture());
        assertThat(message.getValue().type()).isEqualTo(NotificationService.DOSE_NO_RESPONSE);
        assertThat(message.getValue().data()).containsEntry("couleur", "ORANGE").doesNotContainKey("medication");
    }

    @Test
    void confirmationDoesNotAlertCaregiversByPush() {
        service.onDoseStatusChanged(new DoseStatusChanged(doseId, seniorId, "X", prevue, DoseStatus.CONFIRME));

        verify(links, never()).caregiversWithHealthAccess(any());
        verify(push, never()).send(any(), any());
    }

    @Test
    void pushFailureNeverPropagates() {
        when(devices.activeFcmTokens(seniorId)).thenReturn(List.of("tok"));
        when(push.send(any(), any())).thenThrow(new IllegalStateException("réseau"));

        service.onDoseReminderDue(new DoseReminderDue(doseId, seniorId, "X", prevue, false));

        verify(devices, never()).forgetFcmToken(any());
    }
}
