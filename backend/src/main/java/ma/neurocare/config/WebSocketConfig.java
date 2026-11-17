package ma.neurocare.config;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import ma.neurocare.security.StompSecurityInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Temps réel vers l'aidant (cahier §9.4) : endpoint {@code /ws} (SockJS en repli), broker simple en
 * mémoire pour le MVP (RabbitMQ STOMP relay en production multi-instances), topics
 * {@code /topic/seniors/{seniorId}/events}.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompSecurityInterceptor security;
    private final ObjectMapper objectMapper;
    private final List<String> allowedOrigins;

    public WebSocketConfig(StompSecurityInterceptor security, ObjectMapper objectMapper,
                           @Value("${neurocare.websocket.allowed-origins:http://localhost:*,http://127.0.0.1:*}")
                           List<String> allowedOrigins) {
        this.security = security;
        this.objectMapper = objectMapper;
        this.allowedOrigins = allowedOrigins;
    }

    /** Même sérialisation JSON que l'API REST (dates ISO-8601, champs nuls omis). */
    @Override
    public boolean configureMessageConverters(List<MessageConverter> converters) {
        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(objectMapper);
        converters.add(converter);
        return false;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = allowedOrigins.toArray(String[]::new);
        // Les applications natives n'envoient pas d'en-tête Origin : elles ne sont pas concernées par ce filtre.
        registry.addEndpoint("/ws").setAllowedOriginPatterns(origins);
        registry.addEndpoint("/ws").setAllowedOriginPatterns(origins).withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(security);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(security);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        security.forget(event.getSessionId());
    }
}
