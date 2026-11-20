/**
 * Module 6 — Alzheimer & Mémoire : questionnaire d'observation des « 4 A » et exercice des 4 mots.
 *
 * Ce n'est pas une échelle validée : l'« indice de vigilance cognitive » n'est ni un score Alzheimer, ni un
 * risque, ni une probabilité. Il ne dit que deux choses : « rien d'inhabituel n'est ressorti » ou « des signes
 * méritent d'être signalés à un médecin ». Pré-dépistage et aide à la consultation, jamais un diagnostic.
 * Les textes (français ou arabe) sont dans `t.memory` ; ce fichier ne contient que des codes et des règles.
 */
import type { Dictionary } from '../../i18n';

export type Domain = 'AMNESIE' | 'APHASIE' | 'APRAXIE' | 'AGNOSIE';

export const DOMAINS: readonly Domain[] = ['AMNESIE', 'APHASIE', 'APRAXIE', 'AGNOSIE'];

export type QuestionCode =
  | 'OUBLIS_RECENTS'
  | 'QUESTIONS_REPETEES'
  | 'MANQUE_DU_MOT'
  | 'PERIPHRASES'
  | 'GESTES_SIMPLES'
  | 'OBJETS_USUELS'
  | 'OBJETS_FAMILIERS'
  | 'LIEUX_VISAGES';

export interface Question {
  code: QuestionCode;
  domain: Domain;
}

/** 8 questions, 2 par domaine ; « Oui » = signe observé. */
export const QUESTIONS: readonly Question[] = [
  { code: 'OUBLIS_RECENTS', domain: 'AMNESIE' },
  { code: 'QUESTIONS_REPETEES', domain: 'AMNESIE' },
  { code: 'MANQUE_DU_MOT', domain: 'APHASIE' },
  { code: 'PERIPHRASES', domain: 'APHASIE' },
  { code: 'GESTES_SIMPLES', domain: 'APRAXIE' },
  { code: 'OBJETS_USUELS', domain: 'APRAXIE' },
  { code: 'OBJETS_FAMILIERS', domain: 'AGNOSIE' },
  { code: 'LIEUX_VISAGES', domain: 'AGNOSIE' },
];

export type Answers = Partial<Record<QuestionCode, boolean>>;

export function nextQuestion(answers: Answers): Question | null {
  return QUESTIONS.find((q) => answers[q.code] === undefined) ?? null;
}

export function isComplete(answers: Answers): answers is Record<QuestionCode, boolean> {
  return nextQuestion(answers) === null;
}

/** Nombre de signes observés par domaine (0 à 2). */
export function signsByDomain(answers: Answers): Record<Domain, number> {
  const counts: Record<Domain, number> = { AMNESIE: 0, APHASIE: 0, APRAXIE: 0, AGNOSIE: 0 };
  for (const q of QUESTIONS) if (answers[q.code] === true) counts[q.domain] += 1;
  return counts;
}

// ── Exercice des 4 mots ──────────────────────────────────────────────────────

export type WordId = 'CLE' | 'CITRON' | 'HORLOGE' | 'OLIVIER';
export type ThingId = WordId | 'POMME' | 'CISEAUX' | 'VELO' | 'PARAPLUIE' | 'LUNETTES' | 'POISSON' | 'ROSE' | 'TELEPHONE';

export const WORDS: readonly { id: WordId; emoji: string }[] = [
  { id: 'CLE', emoji: '🔑' },
  { id: 'CITRON', emoji: '🍋' },
  { id: 'HORLOGE', emoji: '🕰️' },
  { id: 'OLIVIER', emoji: '🌳' },
];

const WORD_IDS: readonly ThingId[] = WORDS.map((w) => w.id);

/** Objets proposés en reconnaissance visuelle : les 4 mots appris mêlés à 8 intrus, dans un ordre fixe. */
export const RECOGNITION_CHOICES: readonly { id: ThingId; emoji: string }[] = [
  { id: 'POMME', emoji: '🍎' },
  { id: 'HORLOGE', emoji: '🕰️' },
  { id: 'CISEAUX', emoji: '✂️' },
  { id: 'VELO', emoji: '🚲' },
  { id: 'CLE', emoji: '🔑' },
  { id: 'PARAPLUIE', emoji: '☂️' },
  { id: 'LUNETTES', emoji: '👓' },
  { id: 'CITRON', emoji: '🍋' },
  { id: 'POISSON', emoji: '🐟' },
  { id: 'ROSE', emoji: '🌹' },
  { id: 'OLIVIER', emoji: '🌳' },
  { id: 'TELEPHONE', emoji: '📱' },
];

export const CALCULATION = { options: [13, 17, 23, 27], answer: 17 };

/** Numéro du jour de la semaine (0 = dimanche), libellé : `t.memory.weekdays`. */
export function weekdayOf(date: Date): number {
  return date.getDay();
}

/** Minuscules, sans accents latins ni voyelles courtes arabes ; formes arabes unifiées (أ إ آ → ا, ة → ه, ى → ي). */
export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function tokens(text: string): Set<string> {
  const words = normalizeWord(text).split(/[^a-zء-ي]+/).filter(Boolean);
  // L'article arabe « ال » est ignoré (« المفتاح » = « مفتاح »).
  return new Set(words.flatMap((w) => (w.startsWith('ال') && w.length > 3 ? [w, w.slice(2)] : [w])));
}

/** Mots appris retrouvés dans le texte saisi (ordre, accents, majuscules, article et pluriel indifférents). */
export function recalledWords(text: string, forms: Record<WordId, string[]>): WordId[] {
  const found = tokens(text);
  return WORDS.filter((w) => forms[w.id].some((form) => found.has(normalizeWord(form)))).map((w) => w.id);
}

export interface ExerciseResult {
  /** Mots retrouvés spontanément (0 à 4). */
  rappelLibre: WordId[];
  /** Mots non retrouvés spontanément mais reconnus parmi les images. */
  reconnus: WordId[];
  /** Images d'intrus choisies par erreur. */
  intrusChoisis: ThingId[];
  /** Jour de la semaine (0 = dimanche). */
  jourDemande: number;
  jourRepondu: number;
  calculCorrect: boolean;
}

/** Résultat de la reconnaissance visuelle à partir des images choisies. */
export function scoreRecognition(selected: readonly ThingId[], recalled: readonly WordId[]): Pick<ExerciseResult, 'reconnus' | 'intrusChoisis'> {
  return {
    reconnus: WORDS.map((w) => w.id).filter((id) => !recalled.includes(id) && selected.includes(id)),
    intrusChoisis: selected.filter((id) => !WORD_IDS.includes(id)),
  };
}

// ── Indice de vigilance cognitive ────────────────────────────────────────────

export type Vigilance = 'RASSURANT' | 'SIGNES_A_SIGNALER';

export type Reason =
  | { code: 'SIGNES'; n: number }
  | { code: 'DOMAINE'; domain: Domain }
  | { code: 'RAPPEL'; n: number }
  | { code: 'OUBLIES'; n: number }
  | { code: 'INTRUS'; n: number }
  | { code: 'JOUR' };

export interface VigilanceResult {
  indice: Vigilance;
  /** Raisons des signes d'alerte (vide si rassurant). */
  raisons: Reason[];
}

/**
 * Signes d'alerte : au moins 2 signes observés sur les 4 A, ou les 2 signes d'un même domaine ; au rappel,
 * au plus 1 mot retrouvé spontanément, un mot ni retrouvé ni reconnu, ou plusieurs intrus choisis, ou une
 * erreur sur le jour de la semaine.
 */
export function vigilance(answers: Answers, exercise: ExerciseResult | null): VigilanceResult {
  const raisons: Reason[] = [];
  const signs = signsByDomain(answers);
  const total = DOMAINS.reduce((sum, d) => sum + signs[d], 0);
  if (total >= 2) raisons.push({ code: 'SIGNES', n: total });
  else for (const d of DOMAINS) if (signs[d] === 2) raisons.push({ code: 'DOMAINE', domain: d });

  if (exercise) {
    const libre = exercise.rappelLibre.length;
    const retrouves = libre + exercise.reconnus.length;
    if (libre <= 1) raisons.push({ code: 'RAPPEL', n: libre });
    if (retrouves < WORDS.length) raisons.push({ code: 'OUBLIES', n: WORDS.length - retrouves });
    if (exercise.intrusChoisis.length >= 2) raisons.push({ code: 'INTRUS', n: exercise.intrusChoisis.length });
    if (exercise.jourRepondu !== exercise.jourDemande) raisons.push({ code: 'JOUR' });
  }
  return { indice: raisons.length ? 'SIGNES_A_SIGNALER' : 'RASSURANT', raisons };
}

/** Raison lisible dans la langue choisie. */
export function reasonText(t: Dictionary, reason: Reason): string {
  const r = t.memory.reasons;
  switch (reason.code) {
    case 'SIGNES':
      return r.signs(reason.n);
    case 'DOMAINE':
      return r.domain(t.memory.domains[reason.domain].title);
    case 'RAPPEL':
      return r.recall(reason.n);
    case 'OUBLIES':
      return r.missed(reason.n);
    case 'INTRUS':
      return r.intruders(reason.n);
    case 'JOUR':
      return r.day;
  }
}

/** Conseils personnalisés : un conseil par domaine où un signe a été observé, puis la prévention générale. */
export function personalisedTips(t: Dictionary, answers: Answers): string[] {
  const signs = signsByDomain(answers);
  return [...DOMAINS.filter((d) => signs[d] > 0).map((d) => t.memory.domainTips[d]), ...t.memory.prevention];
}
