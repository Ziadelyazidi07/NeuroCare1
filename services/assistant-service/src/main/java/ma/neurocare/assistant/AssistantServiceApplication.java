package ma.neurocare.assistant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Microservice indépendant de l'Assistant Santé : expose la base de connaissances médicale (versionnée et
 * sourcée OMS / HAS / ESC / FID) que l'application mobile embarque et synchronise quand ce service est
 * joignable. Aucune donnée de patient n'est reçue ni stockée.
 */
@SpringBootApplication
public class AssistantServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AssistantServiceApplication.class, args);
    }
}
