package ma.neurocare.security;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import lombok.extern.slf4j.Slf4j;
import ma.neurocare.user.domain.UserRole;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Sécurité du temps réel STOMP (cahier §8.4, §9.4).
 *
 * <ul>
 *   <li><b>CONNECT</b> : en-tête natif {@code Authorization: Bearer <JWT | token d'appareil>} obligatoire ;</li>
 *   <li><b>SUBSCRIBE</b> : uniquement {@code /topic/seniors/{seniorId}/events}, pour le senior lui-même ou
 *       un aidant au lien validé avec PARTAGE_FAMILIAL ;</li>
 *   <li><b>SEND</b> : refusé (le client ne publie rien) ;</li>
 *   <li><b>sortant</b> : chaque message est revérifié avant livraison, pour qu'une révocation de
 *       PARTAGE_FAMILIAL coupe immédiatement les alertes d'un aidant déjà abonné (EF-CO-04).</li>
 * </ul>
 * Enregistré à la fois sur le canal entrant et sur le canal sortant ({@code WebSocketConfig}).
 */
@Slf4j
@Component
public class StompSecurityInterceptor implements ChannelInterceptor {

    public static final Pattern SENIOR_TOPIC = Pattern.compile("^/topic/seniors/([0-9a-fA-F-]{36})/events$");
    private static final String BEARER = "Bearer ";

    private final JwtService jwtService;
    private final DeviceTokenAuthenticator deviceTokens;
    private final TokenHasher hasher;
    private final AccessPolicy accessPolicy;

    /** Session STOMP → appelant authentifié au CONNECT. */
    private final Map<String, Authentication> sessions = new ConcurrentHashMap<>();

    public StompSecurityInterceptor(JwtService jwtService, DeviceTokenAuthenticator deviceTokens,
                                    TokenHasher hasher, AccessPolicy accessPolicy) {
        this.jwtService = jwtService;
        this.deviceTokens = deviceTokens;
        this.hasher = hasher;
        this.accessPolicy = accessPolicy;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            accessor = StompHeaderAccessor.wrap(message);
        }
        StompCommand command = accessor.getCommand();
        if (command == null) {
            // Messages du broker vers les abonnés : pas de commande STOMP, seulement le type MESSAGE.
            return SimpMessageHeaderAccessor.getMessageType(message.getHeaders()) == SimpMessageType.MESSAGE
                    ? outbound(message, accessor)
                    : message;
        }
        return switch (command) {
            case CONNECT, STOMP -> connect(message, accessor);
            case SUBSCRIBE -> subscribe(message, accessor);
            case SEND -> throw new MessageDeliveryException("Envoi de messages non autorisé.");
            case DISCONNECT -> {
                if (accessor.getSessionId() != null) {
                    sessions.remove(accessor.getSessionId());
                }
                yield message;
            }
            case MESSAGE -> outbound(message, accessor);
            default -> message;
        };
    }

    private Message<?> connect(Message<?> message, StompHeaderAccessor accessor) {
        AuthenticatedUser user = authenticate(accessor.getFirstNativeHeader("Authorization"))
                .orElseThrow(() -> new MessageDeliveryException("Authentification requise (token absent ou invalide)."));
        Authentication authentication = CurrentUser.toAuthentication(user);
        accessor.setUser(authentication);
        sessions.put(accessor.getSessionId(), authentication);
        return message;
    }

    private Message<?> subscribe(Message<?> message, StompHeaderAccessor accessor) {
        Authentication authentication = sessions.get(accessor.getSessionId());
        UUID seniorId = seniorOf(accessor.getDestination())
                .orElseThrow(() -> new MessageDeliveryException("Destination non autorisée."));
        if (authentication == null || !mayReceive(seniorId, authentication)) {
            throw new MessageDeliveryException("Abonnement refusé pour ce senior.");
        }
        return message;
    }

    /** Message du broker vers un client : livré seulement si l'abonné a toujours le droit de le lire. */
    private Message<?> outbound(Message<?> message, StompHeaderAccessor accessor) {
        Optional<UUID> seniorId = seniorOf(accessor.getDestination());
        if (seniorId.isEmpty()) {
            return message;
        }
        Authentication authentication = sessions.get(accessor.getSessionId());
        if (authentication != null && mayReceive(seniorId.get(), authentication)) {
            return message;
        }
        log.debug("Message temps réel non livré : droit d'accès retiré");
        return null;
    }

    boolean mayReceive(UUID seniorId, Authentication authentication) {
        try {
            AuthenticatedUser user = CurrentUser.from(authentication);
            if (user.is(UserRole.SENIOR)) {
                return user.userId().equals(seniorId);
            }
            return accessPolicy.canReadHealthData(seniorId, authentication);
        } catch (RuntimeException e) {
            return false; // senior non lié (404) ou consentement manquant (403)
        }
    }

    private Optional<AuthenticatedUser> authenticate(String header) {
        if (header == null || !header.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            return Optional.empty();
        }
        String token = header.substring(BEARER.length()).trim();
        if (token.startsWith(TokenHasher.DEVICE_TOKEN_PREFIX)) {
            return deviceTokens.authenticate(hasher.sha256(token));
        }
        return jwtService.parse(token);
    }

    static Optional<UUID> seniorOf(String destination) {
        if (destination == null) {
            return Optional.empty();
        }
        Matcher matcher = SENIOR_TOPIC.matcher(destination);
        if (!matcher.matches()) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(matcher.group(1)));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** Nettoyage à la fermeture de la connexion (sans trame DISCONNECT). */
    public void forget(String sessionId) {
        if (sessionId != null) {
            sessions.remove(sessionId);
        }
    }
}
