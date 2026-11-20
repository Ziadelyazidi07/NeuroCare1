import { describe, expect, it, jest } from '@jest/globals';

import {
  DOMAINS,
  QUESTIONS,
  personalisedTips,
  recalledWords,
  scoreRecognition,
  signsByDomain,
  vigilance,
  weekdayOf,
  type Answers,
  type ExerciseResult,
} from '../memory';
import { memoryReportHtml } from '../memoryPdf';
import { buildAssessment } from '../memoryStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const allNo = Object.fromEntries(QUESTIONS.map((q) => [q.code, false])) as Answers;
const goodExercise: ExerciseResult = {
  rappelLibre: ['Clé', 'Citron', 'Horloge'],
  reconnus: ['Olivier'],
  intrusChoisis: [],
  jourDemande: 'Jeudi',
  jourRepondu: 'Jeudi',
  calculCorrect: true,
};

describe('questionnaire des 4 A', () => {
  it('pose 8 questions, 2 par domaine', () => {
    expect(QUESTIONS).toHaveLength(8);
    for (const d of DOMAINS) expect(QUESTIONS.filter((q) => q.domain === d)).toHaveLength(2);
  });

  it('compte les signes par domaine', () => {
    expect(signsByDomain({ ...allNo, OUBLIS_RECENTS: true, QUESTIONS_REPETEES: true, PERIPHRASES: true })).toEqual({
      AMNESIE: 2,
      APHASIE: 1,
      APRAXIE: 0,
      AGNOSIE: 0,
    });
  });
});

describe('exercice des 4 mots', () => {
  it('retrouve les mots sans tenir compte des accents, majuscules, pluriels ni de l’ordre', () => {
    expect(recalledWords('OLIVIERS, une clef et... citron')).toEqual(['Clé', 'Citron', 'Olivier']);
    expect(recalledWords('clé horloge')).toEqual(['Clé', 'Horloge']);
    expect(recalledWords('pomme olive')).toEqual([]);
  });

  it('distingue mots reconnus et intrus choisis', () => {
    expect(scoreRecognition(['Clé', 'Olivier', 'Pomme'], ['Clé'])).toEqual({ reconnus: ['Olivier'], intrusChoisis: ['Pomme'] });
  });

  it('donne le jour de la semaine en français', () => {
    expect(weekdayOf(new Date(2026, 10, 19))).toBe('Jeudi');
  });
});

describe('indice de vigilance cognitive (deux issues, jamais un score)', () => {
  it('rassurant sans signe et avec un bon rappel', () => {
    expect(vigilance(allNo, goodExercise)).toEqual({ indice: 'RASSURANT', raisons: [] });
    expect(vigilance({ ...allNo, MANQUE_DU_MOT: true }, null).indice).toBe('RASSURANT');
  });

  it('signale 2 signes sur les 4 A', () => {
    const r = vigilance({ ...allNo, MANQUE_DU_MOT: true, GESTES_SIMPLES: true }, goodExercise);
    expect(r).toEqual({ indice: 'SIGNES_A_SIGNALER', raisons: ['2 signes observés sur les 8 questions des 4 A.'] });
  });

  it('signale un rappel faible, un mot ni retrouvé ni reconnu, des intrus ou une erreur de jour', () => {
    const r = vigilance(allNo, { ...goodExercise, rappelLibre: ['Clé'], reconnus: ['Citron'], intrusChoisis: ['Rose', 'Vélo'], jourRepondu: 'Lundi' });
    expect(r.indice).toBe('SIGNES_A_SIGNALER');
    expect(r.raisons).toEqual([
      '1 mot sur 4 retrouvé spontanément.',
      '2 mot(s) ni retrouvé(s) ni reconnu(s) parmi les images.',
      '2 images choisies qui ne faisaient pas partie des mots.',
      'Jour de la semaine non retrouvé.',
    ]);
  });

  it('personnalise les conseils selon les domaines touchés, puis la prévention MIND', () => {
    const tips = personalisedTips({ ...allNo, LIEUX_VISAGES: true });
    expect(tips[0]).toMatch(/^Repères/);
    expect(tips.join(' ')).toMatch(/30 minutes.*7 heures.*huile d’olive/s);
    expect(personalisedTips(allNo)[0]).toMatch(/^Marcher 30 minutes/);
  });
});

describe('bilan PDF', () => {
  it('exige les 8 réponses puis reprend nom, domaines, rappel, historique et mention de pré-dépistage', () => {
    expect(buildAssessment({ OUBLIS_RECENTS: true }, null)).toBeNull();
    const a = buildAssessment({ ...allNo, OUBLIS_RECENTS: true }, goodExercise, new Date('2026-11-19T08:00:00Z'));
    if (!a) throw new Error('bilan attendu');
    const html = memoryReportHtml('Ahmed <B>', a, [a], new Date('2026-11-19T08:05:00Z'));
    expect(html).toContain('Ahmed &lt;B&gt;');
    expect(html).toContain('Amnésie');
    expect(html).toContain('1 / 2');
    expect(html).toContain('3 / 4');
    expect(html).toContain('aide à la consultation médicale');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
    expect(html).not.toMatch(/probabilit|risque d.Alzheimer|vous avez/i);
  });
});
