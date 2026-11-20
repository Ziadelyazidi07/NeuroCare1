import { describe, expect, it, jest } from '@jest/globals';

import {
  EMPTY_FORM,
  EMPTY_SIGNS,
  SYMPTOM_KEYS,
  agePoints,
  computeImc,
  findriscPoints,
  imcPoints,
  levelOf,
  parseForm,
  parseHeightCm,
  presentSymptoms,
  symptomAlert,
  totalOf,
  waistPoints,
  type FindriscAnswers,
  type HyperglycemiaSigns,
  type SymptomKey,
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

const noSigns = Object.fromEntries(SYMPTOM_KEYS.map((k) => [k, false])) as HyperglycemiaSigns;
const withSigns = (...keys: SymptomKey[]): HyperglycemiaSigns => ({ ...noSigns, ...Object.fromEntries(keys.map((k) => [k, true])) });

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

  it('exige les 8 réponses FINDRISC puis les 7 signes de la partie 2', () => {
    expect(parseForm(EMPTY_FORM)).toBe('AGE');
    const form = {
      age: '60',
      sexe: 'HOMME' as const,
      poids: '88',
      taille: '1,75',
      tourTaille: '100',
      activitePhysique: false,
      fruitsLegumesQuotidiens: true,
      medicamentsHypertension: true,
      glycemieEleveeAntecedent: false,
      antecedentsFamiliaux: 'ELOIGNES' as const,
      signes: EMPTY_SIGNS,
    };
    expect(parseForm({ ...form, antecedentsFamiliaux: null })).toBe('INCOMPLET');
    expect(parseForm(form)).toBe('SIGNES');
    expect(parseForm({ ...form, signes: { ...noSigns, SOIF: null } })).toBe('SIGNES');
    expect(parseForm({ ...form, signes: withSigns('SOIF') })).toEqual({ ...answers, signes: withSigns('SOIF') });
  });
});

describe('partie 2 : 7 signes cliniques d’alerte (hors score sur 26)', () => {
  it('pose 7 questions Oui / Non traduites en français et en arabe', () => {
    expect(SYMPTOM_KEYS).toEqual(['URINES', 'SOIF', 'FATIGUE', 'BOUCHE_SECHE', 'VISION', 'FAIM', 'AMAIGRISSEMENT']);
    for (const k of SYMPTOM_KEYS) {
      expect(fr.findrisc.symptoms[k].question).toMatch(/\?$/);
      expect(ar.findrisc.symptoms[k].question).toMatch(/[؀-ۿ]/);
    }
    expect(fr.findrisc.symptoms.URINES.question).toContain('2 fois ou plus par nuit');
    expect(fr.findrisc.symptoms.SOIF.question).toContain('plus de 3 litres par jour');
  });

  it('ne modifie jamais le score FINDRISC', () => {
    const all = withSigns(...SYMPTOM_KEYS);
    expect(totalOf(findriscPoints({ ...answers, signes: all }))).toBe(totalOf(findriscPoints(answers)));
  });

  it('gradue l’alerte : aucun signe, 1 signe, 2 signes ou plus, triade', () => {
    expect(symptomAlert(undefined)).toBe('AUCUN');
    expect(symptomAlert(noSigns)).toBe('AUCUN');
    expect(symptomAlert(withSigns('FATIGUE'))).toBe('UN_SIGNE');
    expect(symptomAlert(withSigns('VISION', 'BOUCHE_SECHE'))).toBe('PLUSIEURS');
    expect(symptomAlert(withSigns('URINES', 'SOIF', 'AMAIGRISSEMENT'))).toBe('TRIADE');
    expect(symptomAlert(withSigns(...SYMPTOM_KEYS))).toBe('TRIADE');
    expect(presentSymptoms(withSigns('FAIM', 'URINES'))).toEqual(['URINES', 'FAIM']);
  });

  it('recommande glycémie à jeun et HbA1c auprès d’un médecin, sans diagnostic', () => {
    for (const level of ['UN_SIGNE', 'PLUSIEURS', 'TRIADE'] as const) {
      expect(fr.findrisc.alert[level].message).toMatch(/glycémie à jeun.*HbA1c/);
      expect(fr.findrisc.alert[level].message).toMatch(/médecin/);
      expect(fr.findrisc.alert[level].message).not.toMatch(/vous avez (un )?diabète/i);
      expect(ar.findrisc.alert[level].message).toContain('HbA1c');
    }
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
    expect(html).toContain('Partie 2 non renseignée');
    expect(html).not.toContain('Alerte clinique prioritaire');
  });

  it('détaille les 7 signes et place l’alerte prioritaire avant le score', () => {
    const points = findriscPoints(answers);
    const report = { ...answers, signes: withSigns('URINES', 'SOIF', 'AMAIGRISSEMENT'), datePassation: '2026-11-19T08:00:00Z', imc: 28.7, points, scoreTotal: 14, niveau: 'MODERE' as const };
    const html = findriscReportHtml(fr, 'Hajj Ahmed', report, new Date('2026-11-19T09:00:00Z'));
    expect(html).toContain('Alerte clinique prioritaire : urines fréquentes, soif intense et amaigrissement');
    expect(html.indexOf('Alerte clinique prioritaire')).toBeLessThan(html.indexOf('Risque modéré'));
    expect(html).toContain('Signes présents : Urines fréquentes, Soif intense, Amaigrissement inexpliqué.');
    expect(html).toContain('3 signe(s) présent(s) sur 7');
    expect(html.match(/<tr><td>\d<\/td>/g)).toHaveLength(8 + 7);
    expect(html).toContain('Vision floue');
    expect(html).toContain('14 / 26');
    const none = findriscReportHtml(fr, 'Hajj Ahmed', { ...report, signes: noSigns }, new Date());
    expect(none).toContain('Aucun signe clinique d’alerte signalé.');
    expect(findriscReportHtml(ar, 'المريض', report, new Date())).toContain('تنبيه سريري ذو أولوية');
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
