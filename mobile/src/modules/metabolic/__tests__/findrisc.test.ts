import { describe, expect, it, jest } from '@jest/globals';

import {
  EMPTY_FORM,
  agePoints,
  computeImc,
  findriscPoints,
  imcPoints,
  levelOf,
  parseForm,
  parseHeightCm,
  totalOf,
  waistPoints,
  type FindriscAnswers,
} from '../findrisc';
import { findriscReportHtml } from '../findriscPdf';
import { ar } from '../../../i18n/ar';
import { fr } from '../../../i18n/fr';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const answers: FindriscAnswers = {
  age: 60,
  sexe: 'HOMME',
  poidsKg: 88,
  tailleCm: 175,
  tourTailleCm: 100,
  activitePhysique: false,
  fruitsLegumesQuotidiens: true,
  medicamentsHypertension: true,
  glycemieEleveeAntecedent: false,
  antecedentsFamiliaux: 'ELOIGNES',
};

describe('barème FINDRISC', () => {
  it.each([[44, 0], [45, 2], [54, 2], [55, 3], [64, 3], [65, 4]])('âge %i -> %i pt', (age, pts) => {
    expect(agePoints(age)).toBe(pts);
  });

  it.each([[24.9, 0], [25, 1], [30, 1], [30.1, 3]])('IMC %f -> %i pt', (imc, pts) => {
    expect(imcPoints(imc)).toBe(pts);
  });

  it.each([
    ['HOMME', 93, 0], ['HOMME', 94, 3], ['HOMME', 102, 3], ['HOMME', 103, 4],
    ['FEMME', 79, 0], ['FEMME', 80, 3], ['FEMME', 88, 3], ['FEMME', 89, 4],
  ] as const)('%s %i cm -> %i pt', (sexe, cm, pts) => {
    expect(waistPoints(sexe, cm)).toBe(pts);
  });

  it('calcule IMC et score comme le serveur (14 points, risque modéré)', () => {
    expect(computeImc(88, 175)).toBe(28.7);
    const total = totalOf(findriscPoints(answers));
    expect(total).toBe(14);
    expect(levelOf(total)).toBe('MODERE');
  });

  it('atteint 26 points au maximum', () => {
    const worst: FindriscAnswers = {
      age: 70,
      sexe: 'FEMME',
      poidsKg: 95,
      tailleCm: 160,
      tourTailleCm: 100,
      activitePhysique: false,
      fruitsLegumesQuotidiens: false,
      medicamentsHypertension: true,
      glycemieEleveeAntecedent: true,
      antecedentsFamiliaux: 'PROCHES',
    };
    expect(totalOf(findriscPoints(worst))).toBe(26);
  });

  it.each([
    [6, 'FAIBLE'], [7, 'LEGEREMENT_ACCRU'], [11, 'LEGEREMENT_ACCRU'], [12, 'MODERE'],
    [14, 'MODERE'], [15, 'ELEVE'], [20, 'ELEVE'], [21, 'TRES_ELEVE'],
  ] as const)('%i pts -> %s', (score, level) => {
    expect(levelOf(score)).toBe(level);
  });

  it('accepte la taille en cm ou en m', () => {
    expect(parseHeightCm('175')).toBe(175);
    expect(parseHeightCm('1,75')).toBe(175);
    expect(parseHeightCm('1.68')).toBe(168);
  });

  it('exige les 8 réponses', () => {
    expect(parseForm(EMPTY_FORM)).toBe('AGE');
    expect(
      parseForm({
        age: '60',
        sexe: 'HOMME',
        poids: '88',
        taille: '1,75',
        tourTaille: '100',
        activitePhysique: false,
        fruitsLegumesQuotidiens: true,
        medicamentsHypertension: true,
        glycemieEleveeAntecedent: false,
        antecedentsFamiliaux: 'ELOIGNES',
      }),
    ).toEqual(answers);
  });
});

describe('bilan PDF', () => {
  it('détaille les 8 réponses, poids, taille, IMC, score et orientation', () => {
    const points = findriscPoints(answers);
    const html = findriscReportHtml(
      fr,
      'Hajj Ahmed',
      { ...answers, datePassation: '2026-11-19T08:00:00Z', imc: 28.7, points, scoreTotal: 14, niveau: 'MODERE' },
      new Date('2026-11-19T09:00:00Z'),
    );
    expect(html).toContain('Hajj Ahmed');
    expect(html.match(/<tr><td>\d<\/td>/g)).toHaveLength(8);
    expect(html).toContain('28,7 kg/m²');
    expect(html).toContain('14 / 26');
    expect(html).toContain('Risque modéré (environ 17 %');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
  });

  it('s’édite en arabe, de droite à gauche', () => {
    const points = findriscPoints(answers);
    const html = findriscReportHtml(
      ar,
      'المريض',
      { ...answers, datePassation: '2026-11-19T08:00:00Z', imc: 28.7, points, scoreTotal: 14, niveau: 'MODERE' },
      new Date('2026-11-19T09:00:00Z'),
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('خطر متوسط (حوالي 17 %');
    expect(html).toContain('14 / 26');
  });
});
