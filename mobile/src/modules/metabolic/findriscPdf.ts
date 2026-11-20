import type { Dictionary } from '../../i18n';
import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import {
  MAX_SCORE,
  QUESTION_KEYS,
  SYMPTOM_KEYS,
  decimal,
  levelSummary,
  presentSymptoms,
  symptomAlert,
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

/** Partie 2 : encart d'alerte clinique (si au moins un signe) et détail des 7 signes cardinaux. */
function symptomsHtml(t: Dictionary, r: FindriscReport): { alert: string; detail: string } {
  const f = t.findrisc;
  if (!r.signes) return { alert: '', detail: `<p>${escapeHtml(f.pdf.symptomsNotRecorded)}</p>` };
  const signes = r.signes;
  const level = symptomAlert(signes);
  const present = presentSymptoms(signes);
  const alert =
    level === 'AUCUN'
      ? ''
      : `<div class="box"><strong class="${level === 'UN_SIGNE' ? 'ORANGE' : 'ROUGE'}">${escapeHtml(f.alert[level].title)}</strong><br />
      ${escapeHtml(f.alert[level].message)}<br />${escapeHtml(f.symptomsPresent(present.map((k) => f.symptoms[k].title).join(t.meta.listSeparator)))}</div>`;
  const rows = SYMPTOM_KEYS.map(
    (k, i) =>
      `<tr><td>${i + 1}</td><td><strong>${escapeHtml(f.symptoms[k].title)}</strong><br />${escapeHtml(f.symptoms[k].question)}</td>
      <td class="${signes[k] ? 'ORANGE' : 'VERT'}">${escapeHtml(signes[k] ? t.common.yes : t.common.no)}</td></tr>`,
  ).join('');
  const head = f.pdf.symptomsColumns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const summary = present.length ? f.pdf.symptomsCount(present.length) : f.pdf.symptomsNone;
  return { alert, detail: `<table><tr>${head}</tr>${rows}</table><p>${escapeHtml(summary)}</p>` };
}

/** Bilan FINDRISC nominatif (français ou arabe) : 8 réponses, poids / taille / IMC, score sur 26, orientation et 7 signes d'alerte. */
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
  const symptoms = symptomsHtml(t, r);
  const head = f.pdf.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  const body = `
    <div class="box">${escapeHtml(f.pdf.session(formatDateTime(r.datePassation)))}<br />
      ${escapeHtml(f.pdf.measures(decimal(r.poidsKg), decimal(r.tailleCm)))} · ${escapeHtml(f.pdf.imc)} : <strong>${decimal(r.imc)} kg/m²</strong><br />
      ${escapeHtml(f.pdf.score)} : <strong>${r.scoreTotal} / ${MAX_SCORE}</strong></div>
    <h2>${escapeHtml(f.pdf.resultTitle)}</h2>
    ${symptoms.alert}
    <div class="box"><strong>${escapeHtml(levelSummary(t, r.niveau))}</strong><br />${escapeHtml(f.level[r.niveau].orientation)}</div>
    <h2>${escapeHtml(f.pdf.detailTitle)}</h2>
    <table><tr>${head}</tr>${rows}
      <tr><th colspan="3">${escapeHtml(f.pdf.total)}</th><th>${r.scoreTotal} / ${MAX_SCORE}</th></tr></table>
    <p>${escapeHtml(f.pdf.scoring)}</p>
    <h2>${escapeHtml(f.pdf.symptomsTitle)}</h2>
    ${symptoms.detail}`;

  return pdfDocument({ t, title: f.pdf.title, patient, generatedAt, body });
}
