import { describe, expect, it, jest } from '@jest/globals';

import {
  COMPLEMENTARY,
  GDS_15,
  MINI_GDS,
  QUESTIONS,
  answersToSend,
  nextQuestion,
  outcome,
  type GdsAnswers,
  type GdsCode,
} from '../gds';
import { gdsReportHtml } from '../gdsPdf';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

/** Réponse qui compte (ou non) un point pour chaque question. */
const answer = (codes: GdsCode[], scoring: boolean): GdsAnswers =>
  Object.fromEntries(codes.map((code) => [code, scoring === QUESTIONS[code].scoredAnswer]));

describe('Mini-GDS puis GDS-15', () => {
  it('compte 4 questions Mini-GDS, 15 items GDS-15 et 12 questions complémentaires', () => {
    expect(MINI_GDS).toHaveLength(4);
    expect(GDS_15).toHaveLength(15);
    expect(COMPLEMENTARY).toHaveLength(12);
  });

  it('compte les items inversés sur « Non »', () => {
    expect(['GDS_01', 'GDS_05', 'GDS_07', 'GDS_11', 'GDS_13'].every((c) => !QUESTIONS[c as GdsCode].scoredAnswer)).toBe(true);
    expect(QUESTIONS.MINI_DECOURAGE.scoredAnswer).toBe(true);
  });

  it('arrête le test après une Mini-GDS à 0', () => {
    const answers = answer(MINI_GDS, false);
    expect(nextQuestion(answers)).toBeNull();
    expect(outcome(answers)).toEqual({ miniGds: 0, gds15: null, level: 'INDICE_NORMAL' });
  });

  it('enchaîne sur la GDS-15 dès 1 point', () => {
    const answers: GdsAnswers = { ...answer(MINI_GDS, false), MINI_DECOURAGE: true };
    expect(nextQuestion(answers)).toBe(COMPLEMENTARY[0]);
    expect(outcome(answers)).toBeNull();
  });

  it.each([
    [0, 'INDICE_NORMAL'], [4, 'INDICE_NORMAL'], [5, 'LEGERE_A_MODEREE'], [9, 'LEGERE_A_MODEREE'], [10, 'SEVERE'], [15, 'SEVERE'],
  ] as const)('GDS-15 à %i -> %s', (score, level) => {
    // Mini-GDS positive par « découragé » (hors GDS-15), puis exactement `score` points GDS-15.
    const answers: GdsAnswers = { MINI_DECOURAGE: true, ...answer(GDS_15, false) };
    GDS_15.slice(0, score).forEach((code) => (answers[code] = QUESTIONS[code].scoredAnswer));
    expect(outcome(answers)).toMatchObject({ gds15: score, level });
  });

  it("n'envoie que les réponses de la séquence", () => {
    const stale: GdsAnswers = { ...answer(MINI_GDS, false), GDS_01: true };
    expect(Object.keys(answersToSend(stale)).sort()).toEqual([...MINI_GDS].sort());
  });
});

describe('rapport PDF', () => {
  it('contient le patient, toutes les questions/réponses, les scores et l’orientation', () => {
    const reponses: GdsAnswers = { ...answer(MINI_GDS, true), ...answer(COMPLEMENTARY, false) };
    const html = gdsReportHtml(
      'Hajj Ahmed',
      { datePassation: '2026-11-19T08:00:00Z', reponses, scoreMiniGds: 4, scoreGds15: 3, niveau: 'INDICE_NORMAL' },
      new Date('2026-11-19T09:00:00Z'),
    );
    expect(html).toContain('Hajj Ahmed');
    expect(html.match(/<tr><td>\d+<\/td>/g)).toHaveLength(16);
    expect(html).toContain('4 / 4');
    expect(html).toContain('3 / 15');
    expect(html).toContain('Indice normal');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
  });
});
