/** Questionnaires FINDRISC, stockés sur le téléphone. */
import { newId, prepend, readJson, updateJson } from '../storage';
import { computeImc, findriscPoints, levelOf, totalOf, type FindriscAnswers } from './findrisc';
import type { FindriscReport } from './findriscPdf';

const KEY = 'neurocare.findrisc.assessments';

export interface FindriscAssessment extends FindriscReport {
  id: string;
}

export function loadAssessments(): Promise<FindriscAssessment[]> {
  return readJson<FindriscAssessment[]>(KEY, []);
}

/** Calcule IMC, points et niveau, puis enregistre le questionnaire. */
export function scoreAnswers(answers: FindriscAnswers, now = new Date()): FindriscAssessment {
  const points = findriscPoints(answers);
  const total = totalOf(points);
  return {
    ...answers,
    id: newId(),
    datePassation: now.toISOString(),
    imc: computeImc(answers.poidsKg, answers.tailleCm),
    points,
    scoreTotal: total,
    niveau: levelOf(total),
  };
}

export function saveAssessment(assessment: FindriscAssessment): Promise<FindriscAssessment> {
  return updateJson<FindriscAssessment[], FindriscAssessment>(KEY, [], (list) => ({
    value: prepend(list, assessment),
    result: assessment,
  }));
}
