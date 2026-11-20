/** Bilans « Mémoire & 4 A », stockés sur le téléphone (codes seulement : le texte suit la langue choisie). */
import { newId, prepend, readJson, updateJson } from '../storage';
import {
  isComplete,
  signsByDomain,
  vigilance,
  type Answers,
  type Domain,
  type ExerciseResult,
  type QuestionCode,
  type Reason,
  type ThingId,
  type Vigilance,
  type WordId,
} from './memory';

const KEY = 'neurocare.memory.assessments';

export interface MemoryAssessment {
  id: string;
  date: string;
  reponses: Record<QuestionCode, boolean>;
  signes: Record<Domain, number>;
  /** null si le jeu de mémoire a été passé. */
  exercice: ExerciseResult | null;
  indice: Vigilance;
  raisons: Reason[];
}

// Premiers bilans (avant la traduction) : libellés français à la place des codes.
const LEGACY_THINGS: Record<string, ThingId> = {
  Clé: 'CLE',
  Citron: 'CITRON',
  Horloge: 'HORLOGE',
  Olivier: 'OLIVIER',
  Pomme: 'POMME',
  Ciseaux: 'CISEAUX',
  Vélo: 'VELO',
  Parapluie: 'PARAPLUIE',
  Lunettes: 'LUNETTES',
  Poisson: 'POISSON',
  Rose: 'ROSE',
  Téléphone: 'TELEPHONE',
};
const LEGACY_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const thing = (value: string): ThingId => LEGACY_THINGS[value] ?? (value as ThingId);
const day = (value: number | string): number => (typeof value === 'number' ? value : LEGACY_DAYS.indexOf(value));

/** Relit un bilan enregistré, convertit l'ancien format et recalcule l'indice avec les règles en vigueur. */
function upgrade(a: MemoryAssessment): MemoryAssessment {
  const e = a.exercice as (Omit<ExerciseResult, 'jourDemande' | 'jourRepondu'> & { jourDemande: number | string; jourRepondu: number | string }) | null;
  const exercice: ExerciseResult | null = e
    ? {
        rappelLibre: e.rappelLibre.map(thing) as WordId[],
        reconnus: e.reconnus.map(thing) as WordId[],
        intrusChoisis: e.intrusChoisis.map(thing),
        jourDemande: day(e.jourDemande),
        jourRepondu: day(e.jourRepondu),
        calculCorrect: e.calculCorrect,
      }
    : null;
  return { ...a, exercice, ...vigilance(a.reponses, exercice) };
}

export async function loadAssessments(): Promise<MemoryAssessment[]> {
  return (await readJson<MemoryAssessment[]>(KEY, [])).map(upgrade);
}

/** Construit le bilan (sans l'enregistrer) ; null tant que les 8 questions ne sont pas remplies. */
export function buildAssessment(answers: Answers, exercise: ExerciseResult | null, now = new Date()): MemoryAssessment | null {
  if (!isComplete(answers)) return null;
  const { indice, raisons } = vigilance(answers, exercise);
  return { id: newId(), date: now.toISOString(), reponses: { ...answers }, signes: signsByDomain(answers), exercice: exercise, indice, raisons };
}

export function saveAssessment(assessment: MemoryAssessment): Promise<MemoryAssessment> {
  return updateJson<MemoryAssessment[], MemoryAssessment>(KEY, [], (list) => ({ value: prepend(list, assessment), result: assessment }));
}
