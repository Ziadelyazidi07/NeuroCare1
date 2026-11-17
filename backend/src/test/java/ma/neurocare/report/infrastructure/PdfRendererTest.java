package ma.neurocare.report.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.report.application.WeeklyReport;
import ma.neurocare.report.application.WeeklyReport.DoseLine;
import ma.neurocare.report.application.WeeklyReport.ExerciseEvolution;
import ma.neurocare.report.application.WeeklyReport.ExerciseLine;
import ma.neurocare.report.application.WeeklyReport.TreatmentLine;
import ma.neurocare.report.application.WeeklyReport.TreatmentTotals;
import org.junit.jupiter.api.Test;

/** CA-08 : PDF contenant l'avertissement de non-diagnostic, 1 à 2 pages, généré en moins de 3 s. */
class PdfRendererTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 16);
    private final PdfRenderer renderer = new PdfRenderer();

    @Test
    void reportContainsEveryMandatorySection() throws IOException {
        long start = System.nanoTime();
        byte[] pdf = renderer.render(report(true, "Plus fatigué le soir, à signaler au médecin."));
        assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(3));

        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        String text = text(pdf);
        // 1. En-tête
        assertThat(text).contains("Rapport hebdomadaire de suivi", "Hajj Ahmed", "74 ans", "Salma B.",
                "2026-W47", "16/11/2026", "22/11/2026", "DONNÉES FICTIVES");
        // 2. Avertissement fixe (cahier §11.1)
        assertThat(text).contains(normalize(WeeklyReport.AVERTISSEMENT));
        // 3. Traitements
        assertThat(text).contains("Metformine 500", "1 comprimé pendant le repas", "08:00 (tous les jours)");
        // 4. Observance déclarée et totaux
        assertThat(text).contains("Confirmé", "Sans réponse", "Désactivé", "Délai médian de confirmation", "4 min");
        // 5. Exercices bruts et évolution
        assertThat(text).contains("Rappel de mots", "2 / 3", "66,7 %", "100,0 %");
        // 6. Observations
        assertThat(text).contains("Plus fatigué le soir, à signaler au médecin.");
        // Aucune interprétation clinique
        assertThat(text.toLowerCase()).doesNotContain("score", "risque", "alzheimer probable", "oubli");
    }

    @Test
    void fitsOnOneOrTwoPagesForAFullWeek() throws IOException {
        PdfReader reader = new PdfReader(renderer.render(report(false, null)));
        assertThat(reader.getNumberOfPages()).isBetween(1, 2);
        String text = text(renderer.render(report(false, null)));
        assertThat(text).doesNotContain("DONNÉES FICTIVES").contains("Aucune observation.");
    }

    @Test
    void emptyWeekStillCarriesTheWarning() throws IOException {
        WeeklyReport empty = new WeeklyReport("Hajj Ahmed", null, MONDAY, MONDAY.plusDays(6), "2026-W47", "Salma B.",
                Instant.parse("2026-11-23T09:00:00Z"), ZoneId.of("Africa/Casablanca"), false, List.of(), List.of(),
                List.of(), List.of(), new ExerciseEvolution(0, null, 0, null), null);

        String text = text(renderer.render(empty));
        assertThat(text).contains(normalize(WeeklyReport.AVERTISSEMENT), "non renseigné",
                "Aucun rappel programmé", "Aucun exercice réalisé");
    }

    static WeeklyReport report(boolean fictive, String observations) {
        List<DoseLine> doses = new ArrayList<>();
        for (int d = 0; d < 7; d++) {
            LocalDate day = MONDAY.plusDays(d);
            doses.add(new DoseLine(day, LocalTime.of(8, 0), "Metformine 500",
                    d == 3 ? DoseStatus.SANS_REPONSE : DoseStatus.CONFIRME, d == 3 ? null : LocalTime.of(8, 4)));
            doses.add(new DoseLine(day, LocalTime.of(20, 0), "Metformine 500",
                    d == 5 ? DoseStatus.DESACTIVE : DoseStatus.CONFIRME, d == 5 ? null : LocalTime.of(20, 3)));
        }
        return new WeeklyReport("Hajj Ahmed", 74, MONDAY, MONDAY.plusDays(6), "2026-W47", "Salma B.",
                Instant.parse("2026-11-23T09:00:00Z"), ZoneId.of("Africa/Casablanca"), fictive,
                List.of(new TreatmentLine("Metformine 500", "1 comprimé pendant le repas",
                        "08:00 (tous les jours) ; 20:00 (tous les jours)", true)),
                doses,
                List.of(new TreatmentTotals("Metformine 500", 12, 1, 1, 0, 4L)),
                List.of(new ExerciseLine(LocalDateTime.of(2026, 11, 18, 10, 30), "Rappel de mots", 2, 3, 97, false),
                        new ExerciseLine(LocalDateTime.of(2026, 11, 21, 11, 0), "Rappel de mots", 3, 3, 85, false)),
                new ExerciseEvolution(2, new BigDecimal("66.7"), 3, new BigDecimal("100.0")),
                observations);
    }

    static String text(byte[] pdf) throws IOException {
        PdfReader reader = new PdfReader(pdf);
        PdfTextExtractor extractor = new PdfTextExtractor(reader);
        StringBuilder all = new StringBuilder();
        for (int page = 1; page <= reader.getNumberOfPages(); page++) {
            all.append(extractor.getTextFromPage(page)).append(' ');
        }
        return normalize(all.toString());
    }

    static String normalize(String text) {
        return text.replaceAll("\\s+", " ").trim();
    }
}
