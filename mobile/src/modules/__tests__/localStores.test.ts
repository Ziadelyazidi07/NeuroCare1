import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { bpReportHtml } from '../cardio/bpPdf';
import * as bp from '../cardio/bpStore';
import { MINI_GDS, QUESTIONS, type GdsAnswers } from '../mental/gds';
import * as gds from '../mental/gdsStore';
import { gdsReportHtml } from '../mental/gdsPdf';
import { findriscReportHtml } from '../metabolic/findriscPdf';
import * as findrisc from '../metabolic/findriscStore';
import { DEFAULT_PATIENT, PATIENT_NAME_KEY, displayName } from '../PatientName';
import { spo2ReportHtml } from '../saturation/spo2Pdf';
import * as spo2 from '../saturation/spo2Store';
import { readJson, writeJson } from '../storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const now = new Date('2026-11-19T08:00:00Z');

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('téléphone vierge (ni appairage ni compte)', () => {
  it('ouvre chaque module avec un historique vide', async () => {
    await expect(spo2.loadProfile()).resolves.toBeNull();
    await expect(spo2.loadMeasures()).resolves.toEqual([]);
    await expect(gds.loadAssessments()).resolves.toEqual([]);
    await expect(findrisc.loadAssessments()).resolves.toEqual([]);
    await expect(bp.loadMeasures()).resolves.toEqual([]);
    await expect(bp.loadSeries()).resolves.toEqual([]);
  });

  it('nomme les PDF « Patient » tant que le nom est vide, puis mémorise le nom saisi', async () => {
    expect(displayName('   ')).toBe(DEFAULT_PATIENT);
    await writeJson(PATIENT_NAME_KEY, 'Fatima Z.');
    await expect(readJson(PATIENT_NAME_KEY, '')).resolves.toBe('Fatima Z.');
    expect(displayName('Fatima Z.')).toBe('Fatima Z.');
  });

  it('tolère une donnée locale illisible', async () => {
    await AsyncStorage.setItem('neurocare.spo2.measures', '{pas du json');
    await expect(spo2.loadMeasures()).resolves.toEqual([]);
  });
});

describe('SpO2', () => {
  it('mémorise le profil et chaque mesure classée, la plus récente en premier', async () => {
    await spo2.saveProfile(true);
    await expect(spo2.loadProfile()).resolves.toBe(true);
    await spo2.addMeasure({ spo2: 90, pouls: 80 }, true, now);
    await spo2.addMeasure({ spo2: 84, pouls: 101 }, true, new Date('2026-11-19T09:00:00Z'));
    const measures = await spo2.loadMeasures();
    expect(measures.map((m) => [m.spo2, m.niveau])).toEqual([[84, 'ROUGE'], [90, 'VERT']]);
    expect(spo2ReportHtml(displayName(''), true, measures, now)).toContain('Patient : <strong>Patient</strong>');
  });

  it('ne perd aucune mesure lors d’enregistrements simultanés', async () => {
    await Promise.all([70, 80, 90].map((v) => spo2.addMeasure({ spo2: v, pouls: 70 }, false, now)));
    await expect(spo2.loadMeasures()).resolves.toHaveLength(3);
  });
});

describe('Santé mentale', () => {
  it('cote et mémorise une passation complète, refuse une passation incomplète', async () => {
    const reassuring = Object.fromEntries(MINI_GDS.map((c) => [c, !QUESTIONS[c].scoredAnswer])) as GdsAnswers;
    const saved = await gds.addAssessment(reassuring, now);
    expect(saved).toMatchObject({ scoreMiniGds: 0, scoreGds15: null, niveau: 'INDICE_NORMAL' });
    await expect(gds.loadAssessments()).resolves.toHaveLength(1);
    await expect(gds.addAssessment({ MINI_DECOURAGE: true }, now)).rejects.toThrow('incomplet');
    expect(gdsReportHtml('Patient', saved, now)).toContain('0 / 4');
  });
});

describe('Diabète (FINDRISC)', () => {
  it('calcule IMC et score puis mémorise le bilan', async () => {
    const assessment = findrisc.scoreAnswers(
      {
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
      },
      now,
    );
    expect(assessment).toMatchObject({ imc: 28.7, scoreTotal: 14, niveau: 'MODERE' });
    await findrisc.saveAssessment(assessment);
    const [stored] = await findrisc.loadAssessments();
    expect(findriscReportHtml('Patient', stored, now)).toContain('14 / 26');
  });
});

describe('Tension (HTA)', () => {
  it('mémorise mesures ponctuelles et protocole, une ressaisie remplace le créneau', async () => {
    await expect(bp.addMeasure({ tas: 185, tad: 100, pouls: 80 }, now)).resolves.toMatchObject({ niveau: 'URGENCE_HYPERTENSIVE' });

    const series = await bp.startSeries('2026-11-19', now);
    await bp.recordSlot(series.id, { jour: 1, moment: 'SOIR', rang: 1 }, { tas: 140, tad: 80, pouls: 70 }, now);
    await bp.recordSlot(series.id, { jour: 1, moment: 'MATIN', rang: 1 }, { tas: 150, tad: 80, pouls: 70 }, now);
    await bp.recordSlot(series.id, { jour: 1, moment: 'MATIN', rang: 1 }, { tas: 120, tad: 75, pouls: 70 }, now);

    const [stored] = await bp.loadSeries();
    expect(stored.mesures.map((m) => [m.moment, m.tas])).toEqual([['MATIN', 120], ['SOIR', 140]]);
    await expect(bp.loadMeasures()).resolves.toHaveLength(1);
    await expect(bp.recordSlot('inconnu', { jour: 1, moment: 'MATIN', rang: 1 }, { tas: 120, tad: 75, pouls: 70 })).rejects.toThrow();
    expect(bpReportHtml('Patient', stored, now)).toContain('120/75');
  });
});
