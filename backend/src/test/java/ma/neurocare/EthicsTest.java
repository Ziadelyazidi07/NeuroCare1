package ma.neurocare;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.RecordComponent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import ma.neurocare.cognitive.api.dto.CognitiveDtos;
import ma.neurocare.cardio.api.dto.CardioDtos;
import ma.neurocare.dashboard.api.dto.DashboardDtos;
import ma.neurocare.metabolic.api.dto.MetabolicDtos;
import ma.neurocare.mental.api.dto.MentalDtos;
import ma.neurocare.saturation.api.dto.SaturationDtos;
import ma.neurocare.notification.api.dto.RealtimeMessages;
import ma.neurocare.reminder.api.dto.DoseDtos;
import ma.neurocare.reminder.domain.DoseStatus;
import org.junit.jupiter.api.Test;

/**
 * Engagements éthiques dans le code (cahier §13.3) : aucun champ exposé de type score Alzheimer,
 * risque ou probabilité, aucun diagnostic, et SANS_REPONSE n'est jamais un « oubli ».
 */
class EthicsTest {

    private static final List<String> FORBIDDEN = List.of(
            "score", "risque", "risk", "diagnos", "probab", "alzheimer", "pathologi", "normal", "oubli", "deficit");

    @Test
    void noExposedFieldCarriesAClinicalLabel() {
        List<String> violations = new ArrayList<>();
        for (Class<?> holder : List.of(CognitiveDtos.class, DashboardDtos.class, RealtimeMessages.class, DoseDtos.class)) {
            for (Class<?> dto : holder.getDeclaredClasses()) {
                if (dto.isRecord()) {
                    for (RecordComponent component : dto.getRecordComponents()) {
                        String name = component.getName().toLowerCase(Locale.ROOT);
                        FORBIDDEN.stream().filter(name::contains)
                                .forEach(word -> violations.add(dto.getSimpleName() + "." + component.getName()));
                    }
                }
            }
        }
        assertThat(violations).isEmpty();
    }

    @Test
    void statusesNeverMeanForgotten() {
        assertThat(Arrays.stream(DoseStatus.values()).map(Enum::name))
                .noneMatch(name -> name.contains("OUBLI") || name.contains("NON_PRIS"));
    }

    @Test
    void everyResultViewCarriesTheNonDiagnosticNotice() {
        assertThat(CognitiveDtos.AVERTISSEMENT).contains("sans valeur de diagnostic").contains("ne détecte pas Alzheimer");
        assertThat(DashboardDtos.AVERTISSEMENT).contains("aucun diagnostic").contains("pas que le médicament a été pris");
    }

    /** Échelles standardisées (pré-dépistage autorisé) : toujours la mention « pas un diagnostic, pas un médecin ». */
    @Test
    void screeningScalesAlwaysSayTheyAreNotADiagnosis() {
        for (String notice : List.of(SaturationDtos.AVERTISSEMENT, MentalDtos.AVERTISSEMENT,
                MetabolicDtos.AVERTISSEMENT, CardioDtos.AVERTISSEMENT)) {
            assertThat(notice).contains("pas un diagnostic médical officiel").contains("pas un médecin");
        }
        assertThat(MentalDtos.AssessmentDto.class.getRecordComponents())
                .extracting(RecordComponent::getName).contains("avertissement");
    }
}
