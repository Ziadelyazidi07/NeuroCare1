/**
 * Mini-GDS puis GDS-15 (mêmes codes et même barème que le backend, `GdsQuestion` / `GdsResult`).
 * Étape 1 : 4 questions de la Mini-GDS ; à 0 point, le test s'arrête. Sinon, étape 2 : les 12 items de
 * la GDS-15 pas encore posés (vie vide, heureux et situation désespérée sont communs aux deux échelles).
 */
import type { Dictionary } from '../../i18n';

export type GdsCode =
  | 'MINI_DECOURAGE'
  | 'GDS_01' | 'GDS_02' | 'GDS_03' | 'GDS_04' | 'GDS_05' | 'GDS_06' | 'GDS_07' | 'GDS_08'
  | 'GDS_09' | 'GDS_10' | 'GDS_11' | 'GDS_12' | 'GDS_13' | 'GDS_14' | 'GDS_15';

export type GdsLevel = 'INDICE_NORMAL' | 'LEGERE_A_MODEREE' | 'SEVERE';
export type GdsAnswers = Partial<Record<GdsCode, boolean>>;

/** Énoncés des questions : `t.gds.questions[code]` (français ou arabe). */
interface Question {
  code: GdsCode;
  /** Réponse qui compte 1 point (true = Oui). Les items inversés comptent sur « Non ». */
  scoredAnswer: boolean;
}

const q = (code: GdsCode, scoredAnswer: boolean): Question => ({ code, scoredAnswer });

export const QUESTIONS: Record<GdsCode, Question> = {
  MINI_DECOURAGE: q('MINI_DECOURAGE', true),
  GDS_01: q('GDS_01', false),
  GDS_02: q('GDS_02', true),
  GDS_03: q('GDS_03', true),
  GDS_04: q('GDS_04', true),
  GDS_05: q('GDS_05', false),
  GDS_06: q('GDS_06', true),
  GDS_07: q('GDS_07', false),
  GDS_08: q('GDS_08', true),
  GDS_09: q('GDS_09', true),
  GDS_10: q('GDS_10', true),
  GDS_11: q('GDS_11', false),
  GDS_12: q('GDS_12', true),
  GDS_13: q('GDS_13', false),
  GDS_14: q('GDS_14', true),
  GDS_15: q('GDS_15', true),
};

export const MINI_GDS: GdsCode[] = ['MINI_DECOURAGE', 'GDS_03', 'GDS_07', 'GDS_14'];
export const GDS_15: GdsCode[] = [
  'GDS_01', 'GDS_02', 'GDS_03', 'GDS_04', 'GDS_05', 'GDS_06', 'GDS_07', 'GDS_08',
  'GDS_09', 'GDS_10', 'GDS_11', 'GDS_12', 'GDS_13', 'GDS_14', 'GDS_15',
];
export const COMPLEMENTARY: GdsCode[] = GDS_15.filter((code) => !MINI_GDS.includes(code));

const points = (codes: GdsCode[], answers: GdsAnswers) =>
  codes.reduce((sum, code) => sum + (answers[code] === QUESTIONS[code].scoredAnswer ? 1 : 0), 0);

export function miniGdsScore(answers: GdsAnswers): number {
  return points(MINI_GDS, answers);
}

export function gds15Score(answers: GdsAnswers): number {
  return points(GDS_15, answers);
}

export function levelOfGds15(score: number): GdsLevel {
  if (score >= 10) return 'SEVERE';
  return score >= 5 ? 'LEGERE_A_MODEREE' : 'INDICE_NORMAL';
}

/** Questions à poser dans l'ordre, selon les réponses déjà données (l'étape 2 n'apparaît qu'après une Mini-GDS ≥ 1). */
export function questionSequence(answers: GdsAnswers): GdsCode[] {
  const miniDone = MINI_GDS.every((code) => answers[code] !== undefined);
  return miniDone && miniGdsScore(answers) >= 1 ? [...MINI_GDS, ...COMPLEMENTARY] : MINI_GDS;
}

export function nextQuestion(answers: GdsAnswers): GdsCode | null {
  return questionSequence(answers).find((code) => answers[code] === undefined) ?? null;
}

export interface GdsOutcome {
  miniGds: number;
  /** null : test arrêté après une Mini-GDS à 0. */
  gds15: number | null;
  level: GdsLevel;
}

/** Résultat d'un questionnaire complet (null s'il reste des questions). */
export function outcome(answers: GdsAnswers): GdsOutcome | null {
  if (nextQuestion(answers) !== null) return null;
  const mini = miniGdsScore(answers);
  if (mini === 0) return { miniGds: 0, gds15: null, level: 'INDICE_NORMAL' };
  const gds = gds15Score(answers);
  return { miniGds: mini, gds15: gds, level: levelOfGds15(gds) };
}

/** Réponses à envoyer : uniquement celles de la séquence (une réponse d'étape 2 effacée par un retour arrière disparaît). */
export function answersToSend(answers: GdsAnswers): GdsAnswers {
  return Object.fromEntries(questionSequence(answers).map((code) => [code, answers[code]])) as GdsAnswers;
}

/** Libellé du résultat dans la langue choisie, avec l'arrêt anticipé de la Mini-GDS. */
export function outcomeTitle(t: Dictionary, result: GdsOutcome): string {
  return result.gds15 === null ? t.gds.stoppedTitle : t.gds.level[result.level].title;
}
