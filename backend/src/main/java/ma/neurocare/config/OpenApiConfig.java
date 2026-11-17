package ma.neurocare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    OpenAPI neuroCareOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("NeuroCare API")
                        .version("v1")
                        .description("API d'accompagnement des seniors. NeuroCare aide à suivre des activités "
                                + "et à repérer des changements à discuter avec un professionnel. "
                                + "Il ne détecte pas Alzheimer."))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT ou token d'appareil")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
