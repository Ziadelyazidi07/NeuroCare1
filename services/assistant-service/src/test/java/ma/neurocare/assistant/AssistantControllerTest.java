package ma.neurocare.assistant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.in;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AssistantControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void healthDonneLaVersionEtLesSources() throws Exception {
        mvc.perform(get("/api/v1/assistant/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("assistant-service"))
                .andExpect(jsonPath("$.knowledgeVersion", not(blankOrNullString())))
                .andExpect(jsonPath("$.topics", greaterThanOrEqualTo(15)))
                .andExpect(jsonPath("$.sources", hasItems("OMS", "HAS", "ESC", "FID")));
    }

    @Test
    void knowledgeEstSourceeEtTraduite() throws Exception {
        mvc.perform(get("/api/v1/assistant/knowledge"))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", "\"2026.11.1\""))
                .andExpect(jsonPath("$.disclaimer.fr", not(blankOrNullString())))
                .andExpect(jsonPath("$.disclaimer.ar", not(blankOrNullString())))
                .andExpect(jsonPath("$.topics[*].source.orgs[*]", everyItem(in(new String[] {"OMS", "HAS", "ESC", "FID"}))))
                .andExpect(jsonPath("$.topics[*].category", hasItems("observance", "hta", "diabete", "spo2", "memoire", "mental", "urgence")))
                .andExpect(jsonPath("$.suggestions.darija", hasItems("نسيت الدوا", "الطونسيو طالع", "السكر طالع", "عندي الدوخة")));
    }

    @Test
    void knowledgeRepond304SiLaVersionEstDejaConnue() throws Exception {
        mvc.perform(get("/api/v1/assistant/knowledge").header("If-None-Match", "\"2026.11.1\"")).andExpect(status().isNotModified());
    }

    @Test
    void actuatorHealthPourDocker() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
    }
}
