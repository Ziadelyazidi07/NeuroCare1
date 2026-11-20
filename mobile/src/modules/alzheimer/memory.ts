/**
 * Module 6 — Alzheimer & Mémoire : questionnaire d'observation des « 4 A » et exercice des 4 mots.
 *
 * Ce n'est pas une échelle validée : l'« indice de vigilance cognitive » n'est ni un score Alzheimer, ni un
 * risque, ni une probabilité. Il ne dit que deux choses : « rien d'inhabituel n'est ressorti » ou « des signes
 * méritent d'être signalés à un médecin ». Pré-dépistage et aide à la consultation, jamais un diagnostic.
 */

export type Domain = 'AMNESIE' | 'APHASIE' | 'APRAXIE' | 'AGNOSIE';

export const DOMAINS: readonly Domain[] = ['AMNESIE', 'APHASIE', 'APRAXIE', 'AGNOSIE'];

export const DOMAIN_LABELS: Record<Domain, { title: string; area: string }> = {
  AMNESIE: { title: 'Amnésie', area: 'Mémoire récente' },
  APHASIE: { title: 'Aphasie', area: 'Langage' },
  APRAXIE: { title: 'Apraxie', area: 'Gestes et autonomie' },
  AGNOSIE: { title: 'Agnosie', area: 'Reconnaissance et repères' },
};

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
  text: string;
}

/** 8 questions, 2 par domaine ; « Oui » = signe observé. */
export const QUESTIONS: readonly Question[] = [
  {
    code: 'OUBLIS_RECENTS',
    domain: 'AMNESIE',
    text: 'La personne oublie-t-elle de façon répétée des événements récents (une visite, une conversation, le repas de la veille) ?',
  },
  { code: 'QUESTIONS_REPETEES', domain: 'AMNESIE', text: 'La personne pose-t-elle plusieurs fois la même question dans la même heure ?' },
  { code: 'MANQUE_DU_MOT', domain: 'APHASIE', text: 'La personne cherche-t-elle souvent ses mots pour parler de choses courantes ?' },
  {
    code: 'PERIPHRASES',
    domain: 'APHASIE',
    text: 'La personne remplace-t-elle le nom d’un objet simple par une périphrase (« le truc pour écrire » au lieu de « stylo ») ?',
  },
  {
    code: 'GESTES_SIMPLES',
    domain: 'APRAXIE',
    text: 'La personne a-t-elle une difficulté inhabituelle pour des gestes simples : lacer ses chaussures, fermer des boutons ?',
  },
  {
    code: 'OBJETS_USUELS',
    domain: 'APRAXIE',
    text: 'La personne a-t-elle du mal à se servir d’objets du quotidien qu’elle utilisait sans peine (couverts, téléphone, télécommande) ?',
  },
  { code: 'OBJETS_FAMILIERS', domain: 'AGNOSIE', text: 'La personne a-t-elle du mal à reconnaître des objets familiers de la maison ?' },
  {
    code: 'LIEUX_VISAGES',
    domain: 'AGNOSIE',
    text: 'La personne s’est-elle perdue dans un lieu habituel, ou a-t-elle eu du mal à reconnaître le visage d’un proche ?',
  },
];

export const QUESTIONNAIRE_INSTRUCTIONS =
  'Pensez aux dernières semaines et comparez à ses habitudes. Les questions parlent de « la personne » : elles peuvent être remplies par elle-même ou par un proche.';

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

export interface MemoryItem {
  word: string;
  emoji: string;
  /** Formes acceptées au rappel, sans accent ni majuscule. */
  forms: string[];
}

export const WORDS: readonly MemoryItem[] = [
  { word: 'Clé', emoji: '🔑', forms: ['cle', 'cles', 'clef', 'clefs'] },
  { word: 'Citron', emoji: '🍋', forms: ['citron', 'citrons'] },
  { word: 'Horloge', emoji: '🕰️', forms: ['horloge', 'horloges'] },
  { word: 'Olivier', emoji: '🌳', forms: ['olivier', 'oliviers'] },
];

/** Objets proposés en reconnaissance visuelle : les 4 mots appris mêlés à 8 intrus, dans un ordre fixe. */
export const RECOGNITION_CHOICES: readonly { word: string; emoji: string }[] = [
  { word: 'Pomme', emoji: '🍎' },
  { word: 'Horloge', emoji: '🕰️' },
  { word: 'Ciseaux', emoji: '✂️' },
  { word: 'Vélo', emoji: '🚲' },
  { word: 'Clé', emoji: '🔑' },
  { word: 'Parapluie', emoji: '☂️' },
  { word: 'Lunettes', emoji: '👓' },
  { word: 'Citron', emoji: '🍋' },
  { word: 'Poisson', emoji: '🐟' },
  { word: 'Rose', emoji: '🌹' },
  { word: 'Olivier', emoji: '🌳' },
  { word: 'Téléphone', emoji: '📱' },
];

export const CALCULATION = { question: 'Petit calcul : combien font 20 − 3 ?', options: [13, 17, 23, 27], answer: 17 };

export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;

export function weekdayOf(date: Date): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[date.getDay()] as (typeof WEEKDAYS)[number];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c');
}

/** Mots appris retrouvés dans le texte saisi (ordre, accents, majuscules et pluriel indifférents). */
export function recalledWords(text: string): string[] {
  const tokens = new Set(normalize(text).split(/[^a-z]+/).filter(Boolean));
  return WORDS.filter((item) => item.forms.some((form) => tokens.has(form))).map((item) => item.word);
}

export interface ExerciseResult {
  /** Mots retrouvés spontanément (0 à 4). */
  rappelLibre: string[];
  /** Mots non retrouvés spontanément mais reconnus parmi les images. */
  reconnus: string[];
  /** Images d'intrus choisies par erreur. */
  intrusChoisis: string[];
  jourDemande: string;
  jourRepondu: string;
  calculCorrect: boolean;
}

/** Résultat de la reconnaissance visuelle à partir des images choisies. */
export function scoreRecognition(selected: readonly string[], recalled: readonly string[]): Pick<ExerciseResult, 'reconnus' | 'intrusChoisis'> {
  const targets = WORDS.map((w) => w.word);
  return {
    reconnus: targets.filter((w) => !recalled.includes(w) && selected.includes(w)),
    intrusChoisis: selected.filter((w) => !targets.includes(w)),
  };
}

// ── Indice de vigilance cognitive ────────────────────────────────────────────

export type Vigilance = 'RASSURANT' | 'SIGNES_A_SIGNALER';

export interface VigilanceResult {
  indice: Vigilance;
  /** Raisons lisibles des signes d'alerte (vide si rassurant). */
  raisons: string[];
}

/**
 * Signes d'alerte : au moins 2 signes observés sur les 4 A, ou les 2 signes d'un même domaine ; au rappel,
 * au plus 1 mot retrouvé spontanément, un mot ni retrouvé ni reconnu, ou plusieurs intrus choisis, ou une
 * erreur sur le jour de la semaine.
 */
export function vigilance(answers: Answers, exercise: ExerciseResult | null): VigilanceResult {
  const raisons: string[] = [];
  const signs = signsByDomain(answers);
  const total = DOMAINS.reduce((sum, d) => sum + signs[d], 0);
  if (total >= 2) raisons.push(`${total} signes observés sur les 8 questions des 4 A.`);
  else for (const d of DOMAINS) if (signs[d] === 2) raisons.push(`Les 2 signes du domaine ${DOMAIN_LABELS[d].title} sont présents.`);

  if (exercise) {
    const libre = exercise.rappelLibre.length;
    const retrouves = libre + exercise.reconnus.length;
    if (libre <= 1) raisons.push(`${libre} mot sur 4 retrouvé spontanément.`);
    if (retrouves < WORDS.length) raisons.push(`${WORDS.length - retrouves} mot(s) ni retrouvé(s) ni reconnu(s) parmi les images.`);
    if (exercise.intrusChoisis.length >= 2) raisons.push(`${exercise.intrusChoisis.length} images choisies qui ne faisaient pas partie des mots.`);
    if (exercise.jourRepondu !== exercise.jourDemande) raisons.push('Jour de la semaine non retrouvé.');
  }
  return { indice: raisons.length ? 'SIGNES_A_SIGNALER' : 'RASSURANT', raisons };
}

export const VIGILANCE_TEXT: Record<Vigilance, { title: string; message: string }> = {
  RASSURANT: {
    title: 'Indice de vigilance cognitive : rassurant',
    message:
      'Aucun signe inhabituel n’est ressorti aujourd’hui. Bravo ! Continuez à entretenir votre mémoire au quotidien, et parlez-en à votre médecin si quelque chose change.',
  },
  SIGNES_A_SIGNALER: {
    title: 'Indice de vigilance cognitive : signes à signaler',
    message:
      'Certaines réponses méritent d’en parler à un professionnel. Ce n’est pas un diagnostic : beaucoup de causes (fatigue, stress, médicaments, carence, audition, humeur) peuvent jouer. Prenez rendez-vous avec votre médecin traitant, qui pourra orienter vers un neurologue ou une consultation mémoire pour un bilan neuropsychologique approfondi.',
  },
};

/** Conseils de prévention cognitive (inspirés du régime MIND et des recommandations d'hygiène de vie). */
export const PREVENTION_TIPS: readonly string[] = [
  'Marcher 30 minutes par jour, en une ou plusieurs fois.',
  'Dormir environ 7 heures par nuit, à heures régulières.',
  'Garder des liens : appels, visites, repas en famille, activités de groupe ou associatives.',
  'Assiette de type MIND : huile d’olive, poisson 1 à 2 fois par semaine, une poignée de noix, fruits et légumes verts chaque jour ; limiter sucreries, fritures et charcuterie.',
  'Stimuler l’esprit : lecture, jeux de mots, cartes, apprentissage d’une activité nouvelle.',
  'Faire contrôler tension, glycémie, audition et vue, qui comptent aussi pour la mémoire.',
];

const DOMAIN_TIPS: Record<Domain, string> = {
  AMNESIE: 'Mémoire : un agenda ou un calendrier bien visible, des routines fixes et un endroit unique pour les objets importants (clés, lunettes).',
  APHASIE: 'Langage : parler calmement, une idée à la fois, laisser le temps de trouver le mot sans le finir à sa place.',
  APRAXIE: 'Gestes : simplifier le quotidien (chaussures à scratch, vêtements faciles), décomposer les gestes et sécuriser la maison.',
  AGNOSIE: 'Repères : éclairer la maison, étiqueter les placards, éviter de sortir seul dans un lieu inconnu et garder sur soi un contact d’urgence.',
};

/** Conseils personnalisés : un conseil par domaine où un signe a été observé, puis la prévention générale. */
export function personalisedTips(answers: Answers): string[] {
  const signs = signsByDomain(answers);
  return [...DOMAINS.filter((d) => signs[d] > 0).map((d) => DOMAIN_TIPS[d]), ...PREVENTION_TIPS];
}
