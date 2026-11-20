/**
 * Score FINDRISC sur 26 points (mêmes règles que le backend, `FindriscScore`), calculé tout de suite sur
 * le téléphone pour un résultat immédiat même hors ligne. Estimation de risque, jamais un diagnostic.
 */
import type { Dictionary } from '../../i18n';
import { parseDecimal } from '../ui';

export type Sexe = 'HOMME' | 'FEMME';
export type FamilyHistory = 'AUCUN' | 'ELOIGNES' | 'PROCHES';
export type FindriscLevel = 'FAIBLE' | 'LEGEREMENT_ACCRU' | 'MODERE' | 'ELEVE' | 'TRES_ELEVE';

export interface FindriscAnswers {
  age: number;
  sexe: Sexe;
  poidsKg: number;
  tailleCm: number;
  tourTailleCm: number;
  activitePhysique: boolean;
  fruitsLegumesQuotidiens: boolean;
  medicamentsHypertension: boolean;
  glycemieEleveeAntecedent: boolean;
  antecedentsFamiliaux: FamilyHistory;
}

export interface FindriscPoints {
  age: number;
  imc: number;
  tourTaille: number;
  activitePhysique: number;
  fruitsLegumes: number;
  medicamentsHypertension: number;
  glycemieElevee: number;
  antecedentsFamiliaux: number;
}

export const MAX_SCORE = 26;

/** IMC arrondi à 0,1 : c'est la valeur affichée qui est cotée. */
export function computeImc(poidsKg: number, tailleCm: number): number {
  const m = tailleCm / 100;
  return Math.round((poidsKg / (m * m)) * 10) / 10;
}

/** Taille saisie en cm (175) ou en m (1,75) → cm ; NaN si invalide. */
export function parseHeightCm(text: string): number {
  const value = parseDecimal(text);
  return value > 0 && value < 3 ? Math.round(value * 1000) / 10 : value;
}

export function agePoints(age: number): number {
  if (age < 45) return 0;
  if (age <= 54) return 2;
  return age <= 64 ? 3 : 4;
}

export function imcPoints(imc: number): number {
  if (imc < 25) return 0;
  return imc <= 30 ? 1 : 3;
}

export function waistPoints(sexe: Sexe, cm: number): number {
  const [low, high] = sexe === 'HOMME' ? [94, 102] : [80, 88];
  if (cm < low) return 0;
  return cm <= high ? 3 : 4;
}

const FAMILY_POINTS: Record<FamilyHistory, number> = { AUCUN: 0, ELOIGNES: 3, PROCHES: 5 };

export function findriscPoints(a: FindriscAnswers): FindriscPoints {
  return {
    age: agePoints(a.age),
    imc: imcPoints(computeImc(a.poidsKg, a.tailleCm)),
    tourTaille: waistPoints(a.sexe, a.tourTailleCm),
    activitePhysique: a.activitePhysique ? 0 : 2,
    fruitsLegumes: a.fruitsLegumesQuotidiens ? 0 : 1,
    medicamentsHypertension: a.medicamentsHypertension ? 2 : 0,
    glycemieElevee: a.glycemieEleveeAntecedent ? 5 : 0,
    antecedentsFamiliaux: FAMILY_POINTS[a.antecedentsFamiliaux],
  };
}

export function totalOf(points: FindriscPoints): number {
  return Object.values(points).reduce((sum, p) => sum + p, 0);
}

/** Nombre à une décimale avec virgule (« 28,7 »). */
export function decimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function levelOf(score: number): FindriscLevel {
  if (score > 20) return 'TRES_ELEVE';
  if (score >= 15) return 'ELEVE';
  if (score >= 12) return 'MODERE';
  return score >= 7 ? 'LEGEREMENT_ACCRU' : 'FAIBLE';
}

/** Risque estimé de diabète de type 2 à 10 ans, par niveau (barème officiel). */
export const LEVEL_PERCENT: Record<FindriscLevel, number> = { FAIBLE: 1, LEGEREMENT_ACCRU: 4, MODERE: 17, ELEVE: 33, TRES_ELEVE: 50 };

/** Niveau et pourcentage dans la langue choisie. */
export function levelSummary(t: Dictionary, level: FindriscLevel): string {
  return t.findrisc.summary(t.findrisc.level[level].title, LEVEL_PERCENT[level]);
}

/** Ordre des 8 questions (formulaire et PDF ; libellés : `t.findrisc.questionLabels`). */
export const QUESTION_KEYS: (keyof FindriscPoints)[] = [
  'age',
  'imc',
  'tourTaille',
  'activitePhysique',
  'fruitsLegumes',
  'medicamentsHypertension',
  'glycemieElevee',
  'antecedentsFamiliaux',
];

export const FAMILY_OPTIONS: FamilyHistory[] = ['AUCUN', 'ELOIGNES', 'PROCHES'];

/** Code d'erreur du formulaire (message : `t.findrisc.errors`). */
export type FormError = 'AGE' | 'SEXE' | 'POIDS' | 'TAILLE' | 'TOUR' | 'INCOMPLET';

export interface FindriscForm {
  age: string;
  sexe: Sexe | null;
  poids: string;
  taille: string;
  tourTaille: string;
  activitePhysique: boolean | null;
  fruitsLegumesQuotidiens: boolean | null;
  medicamentsHypertension: boolean | null;
  glycemieEleveeAntecedent: boolean | null;
  antecedentsFamiliaux: FamilyHistory | null;
}

export const EMPTY_FORM: FindriscForm = {
  age: '',
  sexe: null,
  poids: '',
  taille: '',
  tourTaille: '',
  activitePhysique: null,
  fruitsLegumesQuotidiens: null,
  medicamentsHypertension: null,
  glycemieEleveeAntecedent: null,
  antecedentsFamiliaux: null,
};

/** Formulaire → réponses validées, ou code d'erreur. */
export function parseForm(f: FindriscForm): FindriscAnswers | FormError {
  const age = Number(f.age.trim());
  if (!/^\d{2,3}$/.test(f.age.trim()) || age < 18 || age > 120) return 'AGE';
  if (!f.sexe) return 'SEXE';
  const poidsKg = parseDecimal(f.poids);
  if (!(poidsKg >= 20 && poidsKg <= 350)) return 'POIDS';
  const tailleCm = parseHeightCm(f.taille);
  if (!(tailleCm >= 100 && tailleCm <= 250)) return 'TAILLE';
  const tourTailleCm = Number(f.tourTaille.trim());
  if (!/^\d{2,3}$/.test(f.tourTaille.trim()) || tourTailleCm < 40 || tourTailleCm > 200) {
    return 'TOUR';
  }
  if (
    f.activitePhysique === null ||
    f.fruitsLegumesQuotidiens === null ||
    f.medicamentsHypertension === null ||
    f.glycemieEleveeAntecedent === null ||
    f.antecedentsFamiliaux === null
  ) {
    return 'INCOMPLET';
  }
  return {
    age,
    sexe: f.sexe,
    poidsKg,
    tailleCm,
    tourTailleCm,
    activitePhysique: f.activitePhysique,
    fruitsLegumesQuotidiens: f.fruitsLegumesQuotidiens,
    medicamentsHypertension: f.medicamentsHypertension,
    glycemieEleveeAntecedent: f.glycemieEleveeAntecedent,
    antecedentsFamiliaux: f.antecedentsFamiliaux,
  };
}
