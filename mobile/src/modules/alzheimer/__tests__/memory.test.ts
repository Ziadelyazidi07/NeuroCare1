import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ar } from '../../../i18n/ar';
import { fr } from '../../../i18n/fr';
import {
  DOMAINS,
  QUESTIONS,
  areasOfConcern,
  findings,
  personalisedAdvice,
  preventionPlan,
  reasonText,
  recalledWords,
  scoreRecognition,
  signsByDomain,
  vigilance,
  weekdayOf,
  type Answers,
  type ExerciseResult,
} from '../memory';
import { memoryReportHtml } from '../memoryPdf';
import { buildAssessment, loadAssessments } from '../memoryStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const allNo = Object.fromEntries(QUESTIONS.map((q) => [q.code, false])) as Answers;
const THURSDAY = 4;
const goodExercise: ExerciseResult = {
  rappelLibre: ['CLE', 'CITRON', 'HORLOGE'],
  reconnus: ['OLIVIER'],
  intrusChoisis: [],
  jourDemande: THURSDAY,
  jourRepondu: THURSDAY,
  calculCorrect: true,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('questionnaire des 4 A', () => {
  it('pose 8 questions, 2 par domaine, adressées directement au patient dans les deux langues', () => {
    expect(QUESTIONS).toHaveLength(8);
    for (const d of DOMAINS) expect(QUESTIONS.filter((q) => q.domain === d)).toHaveLength(2);
    for (const q of QUESTIONS) {
      expect(fr.memory.questions[q.code]).toMatch(/vous/i);
      expect(fr.memory.questions[q.code]).not.toMatch(/la personne/i);
      expect(ar.memory.questions[q.code]).toMatch(/^هل ت/);
      expect(ar.memory.questions[q.code]).not.toContain('الشخص');
    }
    expect(fr.memory.questions.OUBLIS_RECENTS).toMatch(/^Oubliez-vous/);
    expect(fr.memory.questions.OBJETS_USUELS).toMatch(/^Avez-vous du mal à/);
    expect(ar.memory.questions.OUBLIS_RECENTS).toMatch(/^هل تنسى/);
    expect(ar.memory.questions.OBJETS_USUELS).toMatch(/^هل تجد صعوبة في/);
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
  it('retrouve les mots français sans tenir compte des accents, majuscules, pluriels ni de l’ordre', () => {
    expect(recalledWords('OLIVIERS, une clef et... citron', fr.memory.forms)).toEqual(['CLE', 'CITRON', 'OLIVIER']);
    expect(recalledWords('clé horloge', fr.memory.forms)).toEqual(['CLE', 'HORLOGE']);
    expect(recalledWords('pomme olive', fr.memory.forms)).toEqual([]);
  });

  it('retrouve les mots arabes avec ou sans article, hamza ou tâ marbûta', () => {
    expect(recalledWords('المفتاح، ليمونة، الساعة وشجرة الزيتون', ar.memory.forms)).toEqual(['CLE', 'CITRON', 'HORLOGE', 'OLIVIER']);
    expect(recalledWords('ساروت و حامض', ar.memory.forms)).toEqual(['CLE', 'CITRON']);
    expect(recalledWords('تفاحة', ar.memory.forms)).toEqual([]);
  });

  it('distingue mots reconnus et intrus choisis', () => {
    expect(scoreRecognition(['CLE', 'OLIVIER', 'POMME'], ['CLE'])).toEqual({ reconnus: ['OLIVIER'], intrusChoisis: ['POMME'] });
  });

  it('donne le jour de la semaine (0 = dimanche) et son nom dans chaque langue', () => {
    const day = weekdayOf(new Date(2026, 10, 19));
    expect(day).toBe(THURSDAY);
    expect(fr.memory.weekdays[day]).toBe('Jeudi');
    expect(ar.memory.weekdays[day]).toBe('الخميس');
  });
});

describe('indice de vigilance cognitive (deux issues, jamais un score)', () => {
  it('rassurant sans signe et avec un bon rappel', () => {
    expect(vigilance(allNo, goodExercise)).toEqual({ indice: 'RASSURANT', raisons: [] });
    expect(vigilance({ ...allNo, MANQUE_DU_MOT: true }, null).indice).toBe('RASSURANT');
  });

  it('signale 2 signes sur les 4 A', () => {
    const r = vigilance({ ...allNo, MANQUE_DU_MOT: true, GESTES_SIMPLES: true }, goodExercise);
    expect(r).toEqual({ indice: 'SIGNES_A_SIGNALER', raisons: [{ code: 'SIGNES', n: 2 }] });
    expect(reasonText(fr, r.raisons[0]!)).toBe('2 signes observés sur les 8 questions des 4 A.');
  });

  it('signale un rappel faible, un mot ni retrouvé ni reconnu, des intrus ou une erreur de jour', () => {
    const r = vigilance(allNo, { ...goodExercise, rappelLibre: ['CLE'], reconnus: ['CITRON'], intrusChoisis: ['ROSE', 'VELO'], jourRepondu: 1 });
    expect(r.indice).toBe('SIGNES_A_SIGNALER');
    expect(r.raisons.map((reason) => reasonText(fr, reason))).toEqual([
      '1 mot sur 4 retrouvé spontanément.',
      '2 mot(s) ni retrouvé(s) ni reconnu(s) parmi les images.',
      '2 images choisies qui ne faisaient pas partie des mots.',
      'Jour de la semaine non retrouvé.',
    ]);
    expect(reasonText(ar, r.raisons[3]!)).toBe('لم تتذكّر يوم الأسبوع.');
  });

});

describe('restitution personnalisée (constats, orientation HAS / OMS, prévention Lancet)', () => {
  const aphasiaAgnosia: Answers = { ...allNo, MANQUE_DU_MOT: true, LIEUX_VISAGES: true };
  const weakRecall: ExerciseResult = { ...goodExercise, rappelLibre: ['CLE'], reconnus: ['CITRON'], jourRepondu: 1 };

  it('décrit les domaines touchés avec les signes exacts, le rappel et l’orientation', () => {
    expect(findings(aphasiaAgnosia, weakRecall)).toEqual([
      { code: 'DOMAINE', domain: 'APHASIE', questions: ['MANQUE_DU_MOT'] },
      { code: 'DOMAINE', domain: 'AGNOSIE', questions: ['LIEUX_VISAGES'] },
      { code: 'RAPPEL_INCOMPLET', libre: 1, manquants: 2 },
      { code: 'ORIENTATION_ERREUR' },
    ]);
    expect(findings(allNo, goodExercise)).toEqual([{ code: 'AUCUN_SIGNE' }, { code: 'RAPPEL_AIDE', libre: 3, reconnus: 1 }, { code: 'ORIENTATION_OK' }]);
    expect(findings(allNo, null)).toEqual([{ code: 'AUCUN_SIGNE' }, { code: 'SANS_EXERCICE' }]);
    const advice = personalisedAdvice(fr, aphasiaAgnosia, weakRecall);
    expect(advice.findings[0]).toBe('Aphasie, le langage (accès aux mots) : mots difficiles à trouver.');
    expect(advice.findings).toContain('Rappel des 4 mots : 1 retrouvé(s) spontanément, 2 non retrouvé(s) même avec les images.');
    expect(advice.findings).toContain('Orientation dans le temps : jour de la semaine non retrouvé.');
  });

  it('liste les fonctions à évaluer : domaines touchés, mémoire si rappel faible, orientation si jour faux', () => {
    expect(areasOfConcern(aphasiaAgnosia, weakRecall)).toEqual(['AMNESIE', 'APHASIE', 'AGNOSIE', 'ORIENTATION']);
    expect(areasOfConcern(allNo, goodExercise)).toEqual([]);
  });

  it('oriente vers le médecin : MMSE / MoCA, consultation mémoire et causes réversibles', () => {
    const { medical } = personalisedAdvice(fr, aphasiaAgnosia, weakRecall);
    expect(medical[0]).toBe(
      'Points qui méritent l’attention d’un médecin : la mémoire épisodique (souvenirs récents), le langage (accès aux mots), la reconnaissance et les repères visuo-spatiaux (objets, visages, lieux), l’orientation dans le temps.',
    );
    expect(medical.join(' ')).toMatch(/MMSE ou MoCA.*consultation mémoire.*vitamine B12.*hypothyroïdie.*sommeil.*médicaments/s);
    expect(personalisedAdvice(ar, aphasiaAgnosia, weakRecall).medical.join(' ')).toMatch(/MMSE.*B12/s);
  });

  it('rassure sans signe, et signale un signe isolé sans alarmer', () => {
    expect(personalisedAdvice(fr, allNo, goodExercise).medical).toEqual([fr.memory.analysis.reassure]);
    const single = personalisedAdvice(fr, { ...allNo, GESTES_SIMPLES: true }, goodExercise);
    expect(single.medical[1]).toBe('Un signe isolé concerne les praxies (gestes du quotidien) : surveillez-le et parlez-en lors de votre prochaine consultation.');
    expect(single.practical[0]).toMatch(/^Gestes/);
  });

  it('adapte la prévention au profil (OMS, Commission Lancet) en gardant les 7 axes', () => {
    const plan = preventionPlan(aphasiaAgnosia, weakRecall);
    expect(plan).toHaveLength(7);
    expect(plan.filter((p) => p.priority).map((p) => p.code)).toEqual(['TENSION_GLYCEMIE', 'SOMMEIL', 'STIMULATION', 'SOCIAL', 'AUDITION_VISION']);
    expect(preventionPlan({ ...allNo, GESTES_SIMPLES: true }, goodExercise)[0]).toEqual({ code: 'ACTIVITE', priority: true });
    expect(preventionPlan(allNo, goodExercise).every((p) => !p.priority)).toBe(true);
    const text = personalisedAdvice(fr, allNo, goodExercise).prevention.join(' ');
    expect(text).toMatch(/135\/85.*150 minutes.*30 minutes par jour.*7 à 8 heures.*MIND.*huile d’olive.*oméga-3.*noix.*Stimulation cognitive.*Vie sociale/s);
    expect(personalisedAdvice(fr, aphasiaAgnosia, weakRecall).prevention[0]).toMatch(/^Priorité pour vous · Tension et glycémie/);
    expect(personalisedAdvice(ar, aphasiaAgnosia, weakRecall).prevention[0]).toMatch(/^أولوية بالنسبة لك/);
  });
});

describe('bilans enregistrés', () => {
  it('relit les premiers bilans (libellés français) et recalcule l’indice', async () => {
    const legacy = {
      id: 'ancien',
      date: '2026-11-19T08:00:00Z',
      reponses: allNo,
      signes: signsByDomain(allNo),
      exercice: { rappelLibre: ['Clé', 'Citron', 'Horloge'], reconnus: ['Olivier'], intrusChoisis: [], jourDemande: 'Jeudi', jourRepondu: 'Jeudi', calculCorrect: true },
      indice: 'RASSURANT',
      raisons: [],
    };
    await AsyncStorage.setItem('neurocare.memory.assessments', JSON.stringify([legacy]));
    const [loaded] = await loadAssessments();
    expect(loaded?.exercice).toEqual(goodExercise);
    expect(loaded?.indice).toBe('RASSURANT');
  });
});

describe('bilan PDF', () => {
  it('exige les 8 réponses puis reprend nom, domaines, rappel, historique et mention de pré-dépistage', () => {
    expect(buildAssessment({ OUBLIS_RECENTS: true }, null)).toBeNull();
    const a = buildAssessment({ ...allNo, OUBLIS_RECENTS: true }, goodExercise, new Date('2026-11-19T08:00:00Z'));
    if (!a) throw new Error('bilan attendu');
    const html = memoryReportHtml(fr, 'Ahmed <B>', a, [a], new Date('2026-11-19T08:05:00Z'));
    expect(html).toContain('Ahmed &lt;B&gt;');
    expect(html).toContain('Amnésie');
    expect(html).toContain('1 / 2');
    expect(html).toContain('3 / 4');
    expect(html).toContain('aide à la consultation médicale');
    expect(html).toContain('Oubliez-vous de façon répétée');
    expect(html).toContain('Ce que montrent vos réponses');
    expect(html).toContain('Amnésie, la mémoire épisodique (souvenirs récents) : oublis d’événements récents.');
    expect(html).toContain('Prévention personnalisée (OMS, Commission Lancet)');
    expect(html).toContain('Commission Lancet sur la prévention de la démence (2024');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
    expect(html).not.toMatch(/probabilit|risque d.Alzheimer|vous avez/i);
  });

  it('s’édite en arabe, de droite à gauche', () => {
    const a = buildAssessment(allNo, goodExercise, new Date('2026-11-19T08:00:00Z'));
    if (!a) throw new Error('bilan attendu');
    const html = memoryReportHtml(ar, 'المريض', a, [a], new Date('2026-11-19T08:05:00Z'));
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('مؤشر اليقظة المعرفية: مطمئن');
    expect(html).toContain('مفتاح، ليمون');
  });
});
