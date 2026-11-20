/** Passations Mini-GDS / GDS-15, stockées sur le téléphone. */
import { newId, prepend, readJson, updateJson } from '../storage';
import { answersToSend, outcome, type GdsAnswers, type GdsLevel } from './gds';

const KEY = 'neurocare.gds.assessments';

export interface GdsAssessment {
  id: string;
  datePassation: string;
  reponses: GdsAnswers;
  scoreMiniGds: number;
  scoreGds15: number | null;
  niveau: GdsLevel;
}

export function loadAssessments(): Promise<GdsAssessment[]> {
  return readJson<GdsAssessment[]>(KEY, []);
}

/** Cote un questionnaire complet et l'enregistre ; rejette s'il reste des questions. */
export function addAssessment(answers: GdsAnswers, now = new Date()): Promise<GdsAssessment> {
  const result = outcome(answers);
  if (!result) return Promise.reject(new Error('Questionnaire incomplet.'));
  const assessment: GdsAssessment = {
    id: newId(),
    datePassation: now.toISOString(),
    reponses: answersToSend(answers),
    scoreMiniGds: result.miniGds,
    scoreGds15: result.gds15,
    niveau: result.level,
  };
  return updateJson<GdsAssessment[], GdsAssessment>(KEY, [], (list) => ({ value: prepend(list, assessment), result: assessment }));
}
