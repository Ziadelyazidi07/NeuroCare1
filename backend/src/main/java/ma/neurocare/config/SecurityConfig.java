package ma.neurocare.config;

import ma.neurocare.security.DeviceTokenAuthenticator;
import ma.neurocare.security.DeviceTokenFilter;
import ma.neurocare.security.JwtAuthFilter;
import ma.neurocare.security.JwtService;
import ma.neurocare.security.ProblemSecurityHandlers;
import ma.neurocare.security.TokenHasher;
import ma.neurocare.voice.infrastructure.storage.LocalObjectStorage;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Chaîne de filtres stateless (cahier §8.2).
 *
 * <p>Écarts assumés par rapport au cahier, validés :
 * <ul>
 *   <li>{@code POST /auth/logout} est réservé à AIDANT / MEDECIN (déclaré avant la règle publique {@code /auth/**}) ;</li>
 *   <li>{@code /me/devices} est ouvert à SENIOR et AIDANT (déclaré avant la règle {@code /me/**} réservée au SENIOR).</li>
 * </ul>
 *
 * <p>Les filtres sont instanciés ici (et non déclarés en {@code @Component}) pour ne pas être
 * enregistrés une seconde fois comme filtres servlet par Spring Boot.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final String API = "/api/v1";

    @Bean
    SecurityFilterChain api(HttpSecurity http, ProblemSecurityHandlers problemHandlers, JwtService jwtService,
                            DeviceTokenAuthenticator deviceTokenAuthenticator, TokenHasher tokenHasher)
            throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.POST, API + "/auth/logout").hasAnyRole("AIDANT", "MEDECIN")
                        .requestMatchers(API + "/auth/**").permitAll()
                        // URL signées du stockage local : la signature HMAC + expiration tient lieu d'autorisation.
                        .requestMatchers(HttpMethod.GET, LocalObjectStorage.FILES_PATH).permitAll()
                        .requestMatchers("/actuator/health/**", "/v3/api-docs/**",
                                "/swagger-ui/**", "/swagger-ui.html", "/error").permitAll()
                        .requestMatchers(API + "/me/devices").hasAnyRole("SENIOR", "AIDANT")
                        .requestMatchers(API + "/me/**").hasRole("SENIOR")
                        .requestMatchers(HttpMethod.POST, API + "/seniors").hasRole("AIDANT")
                        // Poignée de main WebSocket publique : l'authentification se fait à la trame
                        // STOMP CONNECT (StompSecurityInterceptor, cahier §8.4).
                        .requestMatchers("/ws/**").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(new DeviceTokenFilter(deviceTokenAuthenticator, tokenHasher),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(new JwtAuthFilter(jwtService), UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(problemHandlers)
                        .accessDeniedHandler(problemHandlers))
                .build();
    }

    /** BCrypt coût 12 (cahier §8.1). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
