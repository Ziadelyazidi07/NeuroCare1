import type { Dictionary } from '../../i18n';
import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import {
  MAX_SCORE,
  QUESTION_KEYS,
  decimal,
  levelSummary,
  type FindriscAnswers,
  type FindriscLevel,
  type FindriscPoints,
} from './findrisc';

export interface FindriscReport extends FindriscAnswers {
  datePassation: string;
  imc: number;
  points: FindriscPoints;
  scoreTotal: number;
  niveau: FindriscLevel;
}

/** Bilan FINDRISC nominatif (français ou arabe) : 8 réponses, poids / taille / IMC, score sur 26 et orientation. */
export function findriscReportHtml(t: Dictionary, patient: string, r: FindriscReport, generatedAt: Date): string {
  const f = t.findrisc;
  const yesNo = (value: boolean) => (value ? t.common.yes : t.common.no);
  const answers: Record<keyof FindriscPoints, string> = {
    age: f.pdf.years(r.age),
    imc: f.pdf.imcAnswer(decimal(r.imc), decimal(r.poidsKg), decimal(r.tailleCm)),
    tourTaille: f.pdf.waistAnswer(r.tourTailleCm, r.sexe === 'HOMME'),
    activitePhysique: yesNo(r.activitePhysique),
    fruitsLegumes: yesNo(r.fruitsLegumesQuotidiens),
    medicamentsHypertension: yesNo(r.medicamentsHypertension),
    glycemieElevee: yesNo(r.glycemieEleveeAntecedent),
    antecedentsFamiliaux: f.familyOptions[r.antecedentsFamiliaux],
  };
  const rows = QUESTION_KEYS.map(
    (key, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(f.questionLabels[key])}</td><td>${escapeHtml(answers[key])}</td><td>${r.points[key]}</td></tr>`,
  ).join('');
  const head = f.pdf.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  const body = `
    <div class="box">${escapeHtml(f.pdf.session(formatDateTime(r.datePassation)))}<br />
      ${escapeHtml(f.pdf.measures(decimal(r.poidsKg), decimal(r.tailleCm)))} · ${escapeHtml(f.pdf.imc)} : <strong>${decimal(r.imc)} kg/m²</strong><br />
      ${escapeHtml(f.pdf.score)} : <strong>${r.scoreTotal} / ${MAX_SCORE}</strong></div>
    <h2>${escapeHtml(f.pdf.resultTitle)}</h2>
    <div class="box"><strong>${escapeHtml(levelSummary(t, r.niveau))}</strong><br />${escapeHtml(f.level[r.niveau].orientation)}</div>
    <h2>${escapeHtml(f.pdf.detailTitle)}</h2>
    <table><tr>${head}</tr>${rows}
      <tr><th colspan="3">${escapeHtml(f.pdf.total)}</th><th>${r.scoreTotal} / ${MAX_SCORE}</th></tr></table>
    <p>${escapeHtml(f.pdf.scoring)}</p>`;

  return pdfDocument({ t, title: f.pdf.title, patient, generatedAt, body });
}
