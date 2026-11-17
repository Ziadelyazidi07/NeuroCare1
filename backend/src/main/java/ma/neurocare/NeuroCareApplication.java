package ma.neurocare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * NeuroCare — monolithe modulaire. Aucun utilisateur en mémoire : l'authentification
 * repose uniquement sur JWT (aidant / médecin) et token d'appareil (senior).
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class NeuroCareApplication {

    public static void main(String[] args) {
        SpringApplication.run(NeuroCareApplication.class, args);
    }
}
