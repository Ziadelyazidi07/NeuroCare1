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

// ── Restitution personnalisée ────────────────────────────────────────────────
// Construite à partir des réponses exactes : domaines touchés (et questions concernées), rappel des 4 mots,
// orientation temporelle. Orientation médicale (HAS, OMS, consultation mémoire) et prévention fondée sur
// les facteurs modifiables (OMS 2019, Commission Lancet 2024). Faits observés seulement, jamais de diagnostic.

/** Point à faire évaluer : un des 4 A, ou l'orientation dans le temps. */
export type Area = Domain | 'ORIENTATION';

export type Finding =
  | { code: 'AUCUN_SIGNE' }
  | { code: 'DOMAINE'; domain: Domain; questions: QuestionCode[] }
  | { code: 'SANS_EXERCICE' }
  | { code: 'RAPPEL_COMPLET' }
  | { code: 'RAPPEL_AIDE'; libre: number; reconnus: number }
  | { code: 'RAPPEL_INCOMPLET'; libre: number; manquants: number }
  | { code: 'INTRUS'; n: number }
  | { code: 'ORIENTATION_OK' }
  | { code: 'ORIENTATION_ERREUR' };

export type PreventionCode = 'TENSION_GLYCEMIE' | 'ACTIVITE' | 'SOMMEIL' | 'MIND' | 'STIMULATION' | 'SOCIAL' | 'AUDITION_VISION';

/** Ordre par défaut des 7 axes de prévention. */
export const PREVENTION: readonly PreventionCode[] = ['TENSION_GLYCEMIE', 'ACTIVITE', 'SOMMEIL', 'MIND', 'STIMULATION', 'SOCIAL', 'AUDITION_VISION'];

/** Constats factuels, dans l'ordre : 4 A, rappel des mots, reconnaissance, orientation. */
export function findings(answers: Answers, exercise: ExerciseResult | null): Finding[] {
  const list: Finding[] = [];
  for (const d of DOMAINS) {
    const questions = QUESTIONS.filter((q) => q.domain === d && answers[q.code] === true).map((q) => q.code);
    if (questions.length) list.push({ code: 'DOMAINE', domain: d, questions });
  }
  if (!list.length) list.push({ code: 'AUCUN_SIGNE' });
  if (!exercise) return [...list, { code: 'SANS_EXERCICE' }];
  const libre = exercise.rappelLibre.length;
  const manquants = WORDS.length - libre - exercise.reconnus.length;
  if (manquants > 0) list.push({ code: 'RAPPEL_INCOMPLET', libre, manquants });
  else if (libre < WORDS.length) list.push({ code: 'RAPPEL_AIDE', libre, reconnus: exercise.reconnus.length });
  else list.push({ code: 'RAPPEL_COMPLET' });
  if (exercise.intrusChoisis.length) list.push({ code: 'INTRUS', n: exercise.intrusChoisis.length });
  list.push({ code: exercise.jourRepondu === exercise.jourDemande ? 'ORIENTATION_OK' : 'ORIENTATION_ERREUR' });
  return list;
}

/** Domaines où au moins un signe est observé, plus la mémoire si le rappel est faible et l'orientation si le jour est faux. */
export function areasOfConcern(answers: Answers, exercise: ExerciseResult | null): Area[] {
  const signs = signsByDomain(answers);
  const codes = vigilance(answers, exercise).raisons.map((r) => r.code);
  const memoryWeak = codes.some((c) => c === 'RAPPEL' || c === 'OUBLIES' || c === 'INTRUS');
  const areas: Area[] = DOMAINS.filter((d) => signs[d] > 0 || (d === 'AMNESIE' && memoryWeak));
  return codes.includes('JOUR') ? [...areas, 'ORIENTATION'] : areas;
}

/** Axes de prévention, ceux qui répondent au profil d'abord (marqués prioritaires). */
export function preventionPlan(answers: Answers, exercise: ExerciseResult | null): { code: PreventionCode; priority: boolean }[] {
  const areas = areasOfConcern(answers, exercise);
  const priority = new Set<PreventionCode>();
  const add = (...codes: PreventionCode[]) => codes.forEach((c) => priority.add(c));
  if (areas.includes('AMNESIE')) add('STIMULATION', 'SOMMEIL');
  if (areas.includes('APHASIE')) add('SOCIAL', 'STIMULATION');
  if (areas.includes('APRAXIE')) add('ACTIVITE');
  if (areas.includes('AGNOSIE') || areas.includes('ORIENTATION')) add('AUDITION_VISION', 'SOCIAL');
  if (vigilance(answers, exercise).indice === 'SIGNES_A_SIGNALER') add('TENSION_GLYCEMIE');
  const plan = PREVENTION.map((code) => ({ code, priority: priority.has(code) }));
  return [...plan.filter((p) => p.priority), ...plan.filter((p) => !p.priority)];
}

/** Constat lisible dans la langue choisie. */
export function findingText(t: Dictionary, f: Finding): string {
  const a = t.memory.analysis;
  switch (f.code) {
    case 'AUCUN_SIGNE':
      return a.noSign;
    case 'DOMAINE':
      return a.domain(t.memory.domains[f.domain].title, t.memory.areas[f.domain], f.questions.map((q) => t.memory.questionShort[q]).join(t.meta.listSeparator));
    case 'SANS_EXERCICE':
      return t.memory.noExercise;
    case 'RAPPEL_COMPLET':
      return a.recallFull;
    case 'RAPPEL_AIDE':
      return a.recallAided(f.libre, f.reconnus);
    case 'RAPPEL_INCOMPLET':
      return a.recallMissed(f.libre, f.manquants);
    case 'INTRUS':
      return a.intruders(f.n);
    case 'ORIENTATION_OK':
      return a.orientationOk;
    case 'ORIENTATION_ERREUR':
      return a.orientationWrong;
  }
}

export interface Advice {
  /** Ce que montrent les réponses. */
  findings: string[];
  /** Orientation médicale (consultation, bilan neuropsychologique et biologique) ou réassurance. */
  medical: string[];
  /** Aménagements du quotidien, un par domaine touché. */
  practical: string[];
  /** Prévention des facteurs modifiables, axes prioritaires en tête. */
  prevention: string[];
}

/** Restitution complète, adaptée aux réponses exactes (écran et PDF). */
export function personalisedAdvice(t: Dictionary, answers: Answers, exercise: ExerciseResult | null): Advice {
  const m = t.memory;
  const a = m.analysis;
  const areas = areasOfConcern(answers, exercise);
  const names = areas.map((area) => m.areas[area]).join(t.meta.listSeparator);
  const medical =
    vigilance(answers, exercise).indice === 'SIGNES_A_SIGNALER'
      ? [a.medicalAreas(names), a.medicalConsult, a.medicalBiology, a.medicalBring]
      : areas.length
        ? [a.reassure, a.isolated(names)]
        : [a.reassure];
  const signs = signsByDomain(answers);
  return {
    findings: findings(answers, exercise).map((f) => findingText(t, f)),
    medical,
    practical: DOMAINS.filter((d) => signs[d] > 0).map((d) => m.domainTips[d]),
    prevention: preventionPlan(answers, exercise).map((p) => (p.priority ? a.priority(m.prevention[p.code]) : m.prevention[p.code])),
  };
}
