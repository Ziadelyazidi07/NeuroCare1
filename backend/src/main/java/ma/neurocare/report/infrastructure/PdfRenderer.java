package ma.neurocare.report.infrastructure;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;
import ma.neurocare.reminder.domain.DoseStatus;
import ma.neurocare.report.application.WeeklyReport;
import ma.neurocare.report.application.WeeklyReport.DoseLine;
import ma.neurocare.report.application.WeeklyReport.ExerciseLine;
import ma.neurocare.report.application.WeeklyReport.TreatmentLine;
import ma.neurocare.report.application.WeeklyReport.TreatmentTotals;
import org.springframework.stereotype.Component;

/**
 * Rendu PDF A4 du rapport hebdomadaire avec OpenPDF (cahier §11.2, option A). Police Unicode intégrée
 * (LiberationSans, fournie par OpenPDF) pour les accents et la ponctuation française. Les statuts sont
 * toujours écrits en toutes lettres : la couleur n'est qu'un repère complémentaire.
 */
@Component
public class PdfRenderer {

    private static final String FONT = "font-fallback/LiberationSans-Regular.ttf";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH);
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE dd/MM", Locale.FRENCH);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final Color INK = new Color(33, 37, 41);
    private static final Color MUTED = new Color(95, 99, 104);
    private static final Color HEADER_BG = new Color(232, 238, 245);
    private static final Color WARNING_BG = new Color(255, 248, 225);
    private static final Color WARNING_BORDER = new Color(204, 153, 0);
    private static final Color GREEN = new Color(220, 241, 225);
    private static final Color ORANGE = new Color(253, 230, 205);
    private static final Color GREY = new Color(236, 236, 236);

    private final BaseFont baseFont;

    public PdfRenderer() {
        try {
            this.baseFont = BaseFont.createFont(FONT, BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Police du rapport introuvable", e);
        }
    }

    public byte[] render(WeeklyReport report) {
        Fonts f = new Fonts(baseFont);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 40, 40, 40, 50);
        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new Footer(f));
            document.addTitle("NeuroCare — Rapport hebdomadaire " + report.semaineIso());
            document.addCreator("NeuroCare");
            document.open();

            header(document, report, f);
            warning(document, f);
            treatments(document, report.traitements(), f);
            adherence(document, report, f);
            exercises(document, report, f);
            observations(document, report, f);
        } catch (DocumentException e) {
            throw new IllegalStateException("Génération du PDF impossible", e);
        } finally {
            document.close();
        }
        return out.toByteArray();
    }

    // ---------- Sections ----------

    private static void header(Document doc, WeeklyReport r, Fonts f) {
        doc.add(new Paragraph("NeuroCare — Rapport hebdomadaire de suivi", f.title));
        Paragraph period = new Paragraph("Semaine " + r.semaineIso() + " : du " + DATE.format(r.debut())
                + " au " + DATE.format(r.fin()), f.subtitle);
        period.setSpacingAfter(8);
        doc.add(period);

        if (r.donneesFictives()) {
            Paragraph fictive = new Paragraph("DONNÉES FICTIVES — scénario de démonstration", f.alert);
            fictive.setSpacingAfter(6);
            doc.add(fictive);
        }

        PdfPTable table = new PdfPTable(new float[]{1.3f, 3f});
        table.setWidthPercentage(100);
        labelValue(table, "Senior", r.nomSenior(), f);
        labelValue(table, "Âge", r.age() == null ? "non renseigné" : r.age() + " ans", f);
        labelValue(table, "Période", DATE.format(r.debut()) + " – " + DATE.format(r.fin()), f);
        labelValue(table, "Rapport généré par", r.aidant() + " (aidant)", f);
        labelValue(table, "Généré le", DATE_TIME.format(LocalDateTime.ofInstant(r.genereLe(), r.fuseau()))
                + " (" + r.fuseau().getId() + ")", f);
        table.setSpacingAfter(10);
        doc.add(table);
    }

    private static void warning(Document doc, Fonts f) {
        PdfPTable box = new PdfPTable(1);
        box.setWidthPercentage(100);
        PdfPCell cell = new PdfPCell(new Phrase(WeeklyReport.AVERTISSEMENT, f.bold));
        cell.setBackgroundColor(WARNING_BG);
        cell.setBorderColor(WARNING_BORDER);
        cell.setBorderWidth(1.2f);
        cell.setPadding(8);
        box.addCell(cell);
        box.setSpacingAfter(12);
        doc.add(box);
    }

    private static void treatments(Document doc, List<TreatmentLine> lines, Fonts f) {
        section(doc, "1. Traitements suivis", f);
        if (lines.isEmpty()) {
            note(doc, "Aucun traitement enregistré.", f);
            return;
        }
        PdfPTable table = table(new float[]{2.2f, 3f, 3.2f}, f, "Traitement", "Consigne (saisie par l'aidant)", "Horaires");
        for (TreatmentLine line : lines) {
            cell(table, line.nom() + (line.actif() ? "" : " (désactivé)"), f.body, null);
            cell(table, line.consigne() == null ? "—" : line.consigne(), f.body, null);
            cell(table, line.horaires(), f.body, null);
        }
        doc.add(table);
    }

    private static void adherence(Document doc, WeeklyReport r, Fonts f) {
        section(doc, "2. Observance déclarée", f);
        note(doc, "« Confirmé » signifie que le senior a appuyé sur « C'est fait ». « Sans réponse » "
                + "signifie qu'aucune confirmation n'a été reçue dans le délai.", f);
        if (r.prises().isEmpty()) {
            note(doc, "Aucun rappel programmé sur la période.", f);
            return;
        }
        PdfPTable table = table(new float[]{1.6f, 1f, 2.6f, 1.6f, 1.3f}, f,
                "Jour", "Heure", "Traitement", "Statut", "Confirmé à");
        for (DoseLine line : r.prises()) {
            cell(table, DAY.format(line.date()), f.body, null);
            cell(table, TIME.format(line.heure()), f.body, null);
            cell(table, line.traitement(), f.body, null);
            cell(table, label(line.statut()), f.body, colour(line.statut()));
            cell(table, line.confirmeA() == null ? "—" : TIME.format(line.confirmeA()), f.body, null);
        }
        doc.add(table);

        Paragraph totalsTitle = new Paragraph("Totaux par traitement", f.bold);
        totalsTitle.setSpacingBefore(8);
        totalsTitle.setSpacingAfter(4);
        doc.add(totalsTitle);
        PdfPTable totals = table(new float[]{2.6f, 1.1f, 1.2f, 1.2f, 1.1f, 1.9f}, f,
                "Traitement", "Confirmé", "Sans réponse", "Désactivé", "En attente", "Délai médian de confirmation");
        for (TreatmentTotals t : r.totaux()) {
            cell(totals, t.traitement(), f.body, null);
            cell(totals, String.valueOf(t.confirmees()), f.body, null);
            cell(totals, String.valueOf(t.sansReponse()), f.body, null);
            cell(totals, String.valueOf(t.desactivees()), f.body, null);
            cell(totals, String.valueOf(t.enAttente()), f.body, null);
            cell(totals, t.delaiMedianMinutes() == null ? "—" : t.delaiMedianMinutes() + " min", f.body, null);
        }
        doc.add(totals);
    }

    private static void exercises(Document doc, WeeklyReport r, Fonts f) {
        section(doc, "3. Exercices de stimulation (résultats bruts)", f);
        note(doc, "Exercices facultatifs. Valeurs brutes, sans interprétation clinique.", f);
        if (r.exercices().isEmpty()) {
            note(doc, "Aucun exercice réalisé sur la période.", f);
        } else {
            PdfPTable table = table(new float[]{1.8f, 2f, 1.9f, 1f, 1.1f}, f,
                    "Date", "Exercice", "Mots corrects / présentés", "Durée", "Interrompu");
            for (ExerciseLine e : r.exercices()) {
                cell(table, DATE_TIME.format(e.date()), f.body, null);
                cell(table, e.exercice(), f.body, null);
                cell(table, e.corrects() + " / " + e.presentes(), f.body, null);
                cell(table, e.dureeSec() == null ? "—" : e.dureeSec() + " s", f.body, null);
                cell(table, e.interrompu() ? "oui" : "non", f.body, null);
            }
            doc.add(table);
        }
        WeeklyReport.ExerciseEvolution ev = r.evolution();
        Paragraph evolution = new Paragraph("Évolution brute — moyenne des taux de réussite (exercices non "
                + "interrompus) : cette semaine " + percent(ev.moyenneSemaine()) + " (" + ev.exercicesSemaine()
                + " exercice(s)) ; 4 semaines précédentes " + percent(ev.moyennePrecedente()) + " ("
                + ev.exercicesPrecedents() + " exercice(s)).", f.body);
        evolution.setSpacingBefore(6);
        doc.add(evolution);
    }

    private static void observations(Document doc, WeeklyReport r, Fonts f) {
        section(doc, "4. Observations de l'aidant", f);
        doc.add(new Paragraph(r.observations() == null ? "Aucune observation." : r.observations(),
                r.observations() == null ? f.muted : f.body));
    }

    // ---------- Utilitaires de mise en page ----------

    private static void section(Document doc, String title, Fonts f) {
        Paragraph p = new Paragraph(title, f.section);
        p.setSpacingBefore(10);
        p.setSpacingAfter(4);
        doc.add(p);
    }

    /** Note explicative en italique, avec un espace avant le tableau qui suit. */
    private static void note(Document doc, String text, Fonts f) {
        Paragraph p = new Paragraph(text, f.muted);
        p.setLeading(11);
        p.setSpacingAfter(6);
        doc.add(p);
    }

    private static PdfPTable table(float[] widths, Fonts f, String... headers) {
        PdfPTable table = new PdfPTable(widths);
        table.setWidthPercentage(100);
        table.setHeaderRows(1);
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, f.bold));
            cell.setBackgroundColor(HEADER_BG);
            cell.setPadding(4);
            table.addCell(cell);
        }
        return table;
    }

    private static void cell(PdfPTable table, String text, Font font, Color background) {
        PdfPCell cell = new PdfPCell(new Phrase(text == null ? "—" : text, font));
        cell.setPadding(3.5f);
        if (background != null) {
            cell.setBackgroundColor(background);
        }
        table.addCell(cell);
    }

    private static void labelValue(PdfPTable table, String label, String value, Fonts f) {
        PdfPCell l = new PdfPCell(new Phrase(label, f.bold));
        l.setBorder(Rectangle.NO_BORDER);
        l.setPadding(2);
        PdfPCell v = new PdfPCell(new Phrase(value, f.body));
        v.setBorder(Rectangle.NO_BORDER);
        v.setPadding(2);
        table.addCell(l);
        table.addCell(v);
    }

    static String label(DoseStatus status) {
        return switch (status) {
            case CONFIRME -> "Confirmé";
            case SANS_REPONSE -> "Sans réponse";
            case DESACTIVE -> "Désactivé";
            case EN_ATTENTE -> "En attente";
        };
    }

    private static Color colour(DoseStatus status) {
        return switch (status) {
            case CONFIRME -> GREEN;
            case SANS_REPONSE -> ORANGE;
            case EN_ATTENTE, DESACTIVE -> GREY;
        };
    }

    private static String percent(BigDecimal value) {
        return value == null ? "—" : value.toPlainString().replace('.', ',') + " %";
    }

    /** Polices dérivées d'une même police Unicode intégrée. */
    private static final class Fonts {
        final Font title;
        final Font subtitle;
        final Font section;
        final Font body;
        final Font bold;
        final Font muted;
        final Font alert;
        final Font footer;

        Fonts(BaseFont base) {
            title = new Font(base, 16, Font.BOLD, INK);
            subtitle = new Font(base, 11, Font.NORMAL, MUTED);
            section = new Font(base, 12.5f, Font.BOLD, INK);
            body = new Font(base, 9.5f, Font.NORMAL, INK);
            bold = new Font(base, 9.5f, Font.BOLD, INK);
            muted = new Font(base, 8.5f, Font.ITALIC, MUTED);
            alert = new Font(base, 11, Font.BOLD, new Color(180, 60, 0));
            footer = new Font(base, 7.5f, Font.NORMAL, MUTED);
        }
    }

    /** Pied de page : rappel de non-conservation et numéro de page. */
    private static final class Footer extends PdfPageEventHelper {
        private final Fonts fonts;

        Footer(Fonts fonts) {
            this.fonts = fonts;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte canvas = writer.getDirectContent();
            Phrase text = new Phrase(new Chunk("NeuroCare — document généré à la demande, non conservé sur le "
                    + "serveur. Ne constitue pas un diagnostic. Page " + writer.getPageNumber(), fonts.footer));
            ColumnText.showTextAligned(canvas, Element.ALIGN_CENTER, text,
                    (document.left() + document.right()) / 2, document.bottom() - 25, 0);
        }
    }
}
