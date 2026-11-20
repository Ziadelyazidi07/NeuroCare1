/** Bilans « Mémoire & 4 A », stockés sur le téléphone. */
import { newId, prepend, readJson, updateJson } from '../storage';
import { isComplete, signsByDomain, vigilance, type Answers, type Domain, type ExerciseResult, type QuestionCode, type Vigilance } from './memory';

const KEY = 'neurocare.memory.assessments';

export interface MemoryAssessment {
  id: string;
  date: string;
  reponses: Record<QuestionCode, boolean>;
  signes: Record<Domain, number>;
  /** null si l'exercice de mémoire a été passé. */
  exercice: ExerciseResult | null;
  indice: Vigilance;
  raisons: string[];
}

export function loadAssessments(): Promise<MemoryAssessment[]> {
  return readJson<MemoryAssessment[]>(KEY, []);
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
