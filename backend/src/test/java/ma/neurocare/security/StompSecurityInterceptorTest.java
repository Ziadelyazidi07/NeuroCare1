package ma.neurocare.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

/** Cahier §8.4 : token vérifié au CONNECT, abonnement limité aux seniors autorisés, filtrage sortant. */
class StompSecurityInterceptorTest {

    private final JwtService jwt = mock(JwtService.class);
    private final DeviceTokenAuthenticator devices = mock(DeviceTokenAuthenticator.class);
    private final TokenHasher hasher = mock(TokenHasher.class);
    private final AccessPolicy policy = mock(AccessPolicy.class);
    private final StompSecurityInterceptor interceptor = new StompSecurityInterceptor(jwt, devices, hasher, policy);
    private final MessageChannel channel = mock(MessageChannel.class);

    private final UUID aidantId = UUID.randomUUID();
    private final UUID seniorId = UUID.randomUUID();

    @Test
    void connectWithoutValidTokenIsRefused() {
        assertThatThrownBy(() -> interceptor.preSend(connect("s1", null), channel))
                .isInstanceOf(MessageDeliveryException.class);
        when(jwt.parse("bad")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> interceptor.preSend(connect("s1", "Bearer bad"), channel))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void connectWithJwtSetsTheUser() {
        when(jwt.parse("jwt")).thenReturn(Optional.of(AuthenticatedUser.ofJwt(aidantId, UserRole.AIDANT)));

        Message<?> result = interceptor.preSend(connect("s1", "Bearer jwt"), channel);

        assertThat(StompHeaderAccessor.wrap(result).getUser()).isNotNull();
    }

    @Test
    void deviceTokenIsCheckedByHash() {
        when(hasher.sha256("ncd_abc")).thenReturn("hash");
        when(devices.authenticate("hash")).thenReturn(Optional.of(AuthenticatedUser.ofDevice(seniorId, UUID.randomUUID())));

        interceptor.preSend(connect("s2", "Bearer ncd_abc"), channel);

        assertThat(interceptor.preSend(subscribe("s2", "/topic/seniors/" + seniorId + "/events"), channel)).isNotNull();
        assertThatThrownBy(() -> interceptor.preSend(
                subscribe("s2", "/topic/seniors/" + UUID.randomUUID() + "/events"), channel))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void subscriptionRequiresHealthDataAccessAndAKnownTopic() {
        connectedAidant("s1");
        when(policy.canReadHealthData(eq(seniorId), any())).thenThrow(BusinessException.consentRequired("PARTAGE_FAMILIAL"));

        assertThatThrownBy(() -> interceptor.preSend(subscribe("s1", "/topic/seniors/" + seniorId + "/events"), channel))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> interceptor.preSend(subscribe("s1", "/topic/autre"), channel))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void subscribeWithoutConnectIsRefused() {
        assertThatThrownBy(() -> interceptor.preSend(subscribe("inconnue", "/topic/seniors/" + seniorId + "/events"),
                channel)).isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void clientCannotSendMessages() {
        connectedAidant("s1");
        StompHeaderAccessor send = StompHeaderAccessor.create(StompCommand.SEND);
        send.setSessionId("s1");
        send.setDestination("/topic/seniors/" + seniorId + "/events");
        assertThatThrownBy(() -> interceptor.preSend(build(send), channel)).isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void outboundMessageIsDroppedOnceAccessIsRevoked() {
        connectedAidant("s1");
        when(policy.canReadHealthData(eq(seniorId), any())).thenReturn(true);
        assertThat(interceptor.preSend(outbound("s1"), channel)).isNotNull();

        when(policy.canReadHealthData(eq(seniorId), any())).thenThrow(BusinessException.consentRequired("PARTAGE_FAMILIAL"));
        assertThat(interceptor.preSend(outbound("s1"), channel)).isNull();

        interceptor.forget("s1");
        assertThat(interceptor.preSend(outbound("s1"), channel)).isNull();
    }

    private void connectedAidant(String sessionId) {
        when(jwt.parse("jwt")).thenReturn(Optional.of(AuthenticatedUser.ofJwt(aidantId, UserRole.AIDANT)));
        interceptor.preSend(connect(sessionId, "Bearer jwt"), channel);
    }

    private static Message<?> connect(String sessionId, String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId(sessionId);
        if (authorization != null) {
            accessor.setNativeHeader("Authorization", authorization);
        }
        return build(accessor);
    }

    private static Message<?> subscribe(String sessionId, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionId(sessionId);
        accessor.setDestination(destination);
        accessor.setSubscriptionId("sub-0");
        return build(accessor);
    }

    private Message<?> outbound(String sessionId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        accessor.setSessionId(sessionId);
        accessor.setDestination("/topic/seniors/" + seniorId + "/events");
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private static Message<?> build(StompHeaderAccessor accessor) {
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
