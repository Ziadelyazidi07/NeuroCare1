import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { LEVEL_TEXT, QUESTIONS, questionSequence, outcomeTitle, type GdsAnswers, type GdsLevel } from './gds';

export interface GdsReport {
  datePassation: string;
  reponses: GdsAnswers;
  scoreMiniGds: number;
  scoreGds15?: number | null;
  niveau: GdsLevel;
}

/** Rapport GDS nominatif : questions et réponses, scores, restitution et orientation médicale. */
export function gdsReportHtml(patient: string, report: GdsReport, generatedAt: Date): string {
  const sequence = questionSequence(report.reponses);
  const rows = sequence
    .map((code, index) => {
      const answer = report.reponses[code];
      const point = answer === QUESTIONS[code].scoredAnswer ? 1 : 0;
      const step = index < 4 ? 'Mini-GDS' : 'GDS-15';
      return `<tr><td>${index + 1}</td><td>${step}</td><td>${escapeHtml(QUESTIONS[code].text)}</td>
        <td>${answer === undefined ? '—' : answer ? 'Oui' : 'Non'}</td><td>${point}</td></tr>`;
    })
    .join('');
  const gds15 = report.scoreGds15 ?? null;
  const title = outcomeTitle({ miniGds: report.scoreMiniGds, gds15, level: report.niveau });

  const body = `
    <div class="box">Passation du ${formatDateTime(report.datePassation)} (état émotionnel des 7 derniers jours)<br />
      Score Mini-GDS : <strong>${report.scoreMiniGds} / 4</strong><br />
      Score GDS-15 : <strong>${gds15 === null ? 'non réalisé (Mini-GDS à 0, arrêt du test)' : `${gds15} / 15`}</strong></div>
    <h2>Résultat et orientation</h2>
    <div class="box"><strong>${escapeHtml(title)}</strong><br />${escapeHtml(LEVEL_TEXT[report.niveau].orientation)}</div>
    <h2>Questions et réponses</h2>
    <table><tr><th>#</th><th>Échelle</th><th>Question</th><th>Réponse</th><th>Point</th></tr>${rows}</table>
    <p>Barème GDS-15 : 0-4 indice normal ; 5-9 indicateurs compatibles avec une dépression légère à modérée ;
      10-15 indicateurs compatibles avec une dépression sévère. Items comptés sur « Non » : satisfaction de vie,
      bonne humeur, heureux, merveilleux de vivre, plein d’énergie.</p>`;

  return pdfDocument({ title: 'Rapport GDS — santé mentale (Mini-GDS / GDS-15)', patient, generatedAt, body });
}
