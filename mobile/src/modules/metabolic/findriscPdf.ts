import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import {
  FAMILY_LABELS,
  LEVEL_TEXT,
  MAX_SCORE,
  QUESTION_LABELS,
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

const yesNo = (value: boolean) => (value ? 'Oui' : 'Non');
const decimal = (value: number) => value.toFixed(1).replace('.', ',');

/** Bilan FINDRISC nominatif : 8 réponses, poids / taille / IMC, score sur 26 et orientation médicale. */
export function findriscReportHtml(patient: string, r: FindriscReport, generatedAt: Date): string {
  const answers: Record<keyof FindriscPoints, string> = {
    age: `${r.age} ans`,
    imc: `${decimal(r.imc)} kg/m² (poids ${decimal(r.poidsKg)} kg, taille ${decimal(r.tailleCm)} cm)`,
    tourTaille: `${r.tourTailleCm} cm (${r.sexe === 'HOMME' ? 'homme' : 'femme'})`,
    activitePhysique: yesNo(r.activitePhysique),
    fruitsLegumes: yesNo(r.fruitsLegumesQuotidiens),
    medicamentsHypertension: yesNo(r.medicamentsHypertension),
    glycemieElevee: yesNo(r.glycemieEleveeAntecedent),
    antecedentsFamiliaux: FAMILY_LABELS[r.antecedentsFamiliaux],
  };
  const rows = (Object.keys(QUESTION_LABELS) as (keyof FindriscPoints)[])
    .map(
      (key, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(QUESTION_LABELS[key])}</td><td>${escapeHtml(answers[key])}</td><td>${r.points[key]}</td></tr>`,
    )
    .join('');

  const body = `
    <div class="box">Questionnaire du ${formatDateTime(r.datePassation)}<br />
      Poids : ${decimal(r.poidsKg)} kg · Taille : ${decimal(r.tailleCm)} cm · IMC calculé : <strong>${decimal(r.imc)} kg/m²</strong><br />
      Score FINDRISC : <strong>${r.scoreTotal} / ${MAX_SCORE}</strong></div>
    <h2>Résultat et orientation</h2>
    <div class="box"><strong>${escapeHtml(levelSummary(r.niveau))}</strong><br />${escapeHtml(LEVEL_TEXT[r.niveau].orientation)}</div>
    <h2>Détail des 8 réponses</h2>
    <table><tr><th>#</th><th>Question</th><th>Réponse</th><th>Points</th></tr>${rows}
      <tr><th colspan="3">Total</th><th>${r.scoreTotal} / ${MAX_SCORE}</th></tr></table>
    <p>Barème : moins de 7 points risque faible (1 %) ; 7 à 11 légèrement accru (4 %) ; 12 à 14 modéré (17 %) ;
      15 à 20 élevé (33 %) ; plus de 20 très élevé (50 %). Risque estimé de diabète de type 2 à 10 ans.</p>`;

  return pdfDocument({ title: 'Bilan FINDRISC — pré-dépistage du diabète de type 2', patient, generatedAt, body });
}
