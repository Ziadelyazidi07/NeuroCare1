/**
 * Mini-GDS puis GDS-15 (mêmes codes et même barème que le backend, `GdsQuestion` / `GdsResult`).
 * Étape 1 : 4 questions de la Mini-GDS ; à 0 point, le test s'arrête. Sinon, étape 2 : les 12 items de
 * la GDS-15 pas encore posés (vie vide, heureux et situation désespérée sont communs aux deux échelles).
 */
export type GdsCode =
  | 'MINI_DECOURAGE'
  | 'GDS_01' | 'GDS_02' | 'GDS_03' | 'GDS_04' | 'GDS_05' | 'GDS_06' | 'GDS_07' | 'GDS_08'
  | 'GDS_09' | 'GDS_10' | 'GDS_11' | 'GDS_12' | 'GDS_13' | 'GDS_14' | 'GDS_15';

export type GdsLevel = 'INDICE_NORMAL' | 'LEGERE_A_MODEREE' | 'SEVERE';
export type GdsAnswers = Partial<Record<GdsCode, boolean>>;

interface Question {
  code: GdsCode;
  text: string;
  /** Réponse qui compte 1 point (true = Oui). Les items inversés comptent sur « Non ». */
  scoredAnswer: boolean;
}

const q = (code: GdsCode, text: string, scoredAnswer: boolean): Question => ({ code, text, scoredAnswer });

export const QUESTIONS: Record<GdsCode, Question> = {
  MINI_DECOURAGE: q('MINI_DECOURAGE', 'Vous sentez-vous souvent découragé(e) et triste ?', true),
  GDS_01: q('GDS_01', 'Êtes-vous dans l’ensemble satisfait(e) de votre vie ?', false),
  GDS_02: q('GDS_02', 'Avez-vous renoncé à un grand nombre de vos activités et de vos centres d’intérêt ?', true),
  GDS_03: q('GDS_03', 'Avez-vous le sentiment que votre vie est vide ?', true),
  GDS_04: q('GDS_04', 'Vous ennuyez-vous souvent ?', true),
  GDS_05: q('GDS_05', 'Êtes-vous de bonne humeur la plupart du temps ?', false),
  GDS_06: q('GDS_06', 'Avez-vous peur qu’il vous arrive quelque chose de mauvais ?', true),
  GDS_07: q('GDS_07', 'Êtes-vous heureux(se) la plupart du temps ?', false),
  GDS_08: q('GDS_08', 'Vous sentez-vous souvent faible et sans recours ?', true),
  GDS_09: q('GDS_09', 'Préférez-vous rester chez vous plutôt que de sortir et faire de nouvelles choses ?', true),
  GDS_10: q('GDS_10', 'Pensez-vous avoir plus de problèmes de mémoire que la plupart des gens ?', true),
  GDS_11: q('GDS_11', 'Pensez-vous qu’il est merveilleux de vivre à notre époque ?', false),
  GDS_12: q('GDS_12', 'Vous sentez-vous plutôt inutile tel(le) que vous êtes maintenant ?', true),
  GDS_13: q('GDS_13', 'Vous sentez-vous plein(e) d’énergie ?', false),
  GDS_14: q('GDS_14', 'Avez-vous le sentiment que votre situation est désespérée ?', true),
  GDS_15: q('GDS_15', 'Pensez-vous que la situation de la plupart des gens est meilleure que la vôtre ?', true),
};

export const MINI_GDS: GdsCode[] = ['MINI_DECOURAGE', 'GDS_03', 'GDS_07', 'GDS_14'];
export const GDS_15: GdsCode[] = [
  'GDS_01', 'GDS_02', 'GDS_03', 'GDS_04', 'GDS_05', 'GDS_06', 'GDS_07', 'GDS_08',
  'GDS_09', 'GDS_10', 'GDS_11', 'GDS_12', 'GDS_13', 'GDS_14', 'GDS_15',
];
export const COMPLEMENTARY: GdsCode[] = GDS_15.filter((code) => !MINI_GDS.includes(code));

export const INSTRUCTIONS = 'Répondez par Oui ou par Non en pensant à ce que vous avez ressenti au cours des 7 derniers jours.';

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

export const LEVEL_TEXT: Record<GdsLevel, { title: string; orientation: string }> = {
  INDICE_NORMAL: {
    title: 'Indice normal — absence probable de dépression',
    orientation: 'Aucun signe évocateur relevé par ce questionnaire. Refaites-le si l’humeur change.',
  },
  LEGERE_A_MODEREE: {
    title: 'Indicateurs compatibles avec une dépression légère à modérée',
    orientation: 'Il est conseillé d’en parler à un médecin traitant ou à un psychologue.',
  },
  SEVERE: {
    title: 'Indicateurs compatibles avec une dépression sévère',
    orientation:
      'Une consultation médicale est recommandée rapidement. En cas d’idées noires ou de détresse, appelez sans attendre le 15 ou le 141.',
  },
};

/** Libellé du résultat, avec l'arrêt anticipé de la Mini-GDS. */
export function outcomeTitle(result: GdsOutcome): string {
  return result.gds15 === null ? 'Absence probable de dépression (Mini-GDS à 0)' : LEVEL_TEXT[result.level].title;
}
