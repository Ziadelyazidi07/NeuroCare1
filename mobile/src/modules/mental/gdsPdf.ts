import type { Dictionary } from '../../i18n';
import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { QUESTIONS, outcomeTitle, questionSequence, type GdsAnswers, type GdsLevel } from './gds';

export interface GdsReport {
  datePassation: string;
  reponses: GdsAnswers;
  scoreMiniGds: number;
  scoreGds15?: number | null;
  niveau: GdsLevel;
}

/** Rapport GDS nominatif (français ou arabe) : questions et réponses, scores, restitution et orientation. */
export function gdsReportHtml(t: Dictionary, patient: string, report: GdsReport, generatedAt: Date): string {
  const g = t.gds;
  const sequence = questionSequence(report.reponses);
  const rows = sequence
    .map((code, index) => {
      const answer = report.reponses[code];
      const point = answer === QUESTIONS[code].scoredAnswer ? 1 : 0;
      return `<tr><td>${index + 1}</td><td>${g.pdf.scale(index < 4 ? 1 : 2)}</td><td>${escapeHtml(g.questions[code])}</td>
        <td>${answer === undefined ? '—' : escapeHtml(answer ? t.common.yes : t.common.no)}</td><td>${point}</td></tr>`;
    })
    .join('');
  const gds15 = report.scoreGds15 ?? null;
  const title = outcomeTitle(t, { miniGds: report.scoreMiniGds, gds15, level: report.niveau });
  const head = g.pdf.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  const body = `
    <div class="box">${escapeHtml(g.pdf.session(formatDateTime(report.datePassation)))}<br />
      ${escapeHtml(g.pdf.miniScore)} : <strong>${report.scoreMiniGds} / 4</strong><br />
      ${escapeHtml(g.pdf.gdsScore)} : <strong>${gds15 === null ? escapeHtml(g.pdf.notDone) : `${gds15} / 15`}</strong></div>
    <h2>${escapeHtml(g.pdf.resultTitle)}</h2>
    <div class="box"><strong>${escapeHtml(title)}</strong><br />${escapeHtml(g.level[report.niveau].orientation)}</div>
    <h2>${escapeHtml(g.pdf.answersTitle)}</h2>
    <table><tr>${head}</tr>${rows}</table>
    <p>${escapeHtml(g.pdf.scoring)}</p>`;

  return pdfDocument({ t, title: g.pdf.title, patient, generatedAt, body });
}
