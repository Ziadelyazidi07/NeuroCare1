/**
 * Les 5 modules cliniques montés comme sur un téléphone vierge : aucune session, aucun appairage, aucun
 * serveur. Chacun s'ouvre, calcule son alerte ou son score, mémorise l'historique et produit son PDF.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { moveAsync } from 'expo-file-system/legacy';

import AlzheimerScreen from '../alzheimer/AlzheimerScreen';
import { weekdayOf } from '../alzheimer/memory';
import CardioScreen from '../cardio/CardioScreen';
import MentalScreen from '../mental/MentalScreen';
import MetabolicScreen from '../metabolic/MetabolicScreen';
import { PATIENT_NAME_KEY } from '../PatientName';
import SaturationScreen from '../saturation/SaturationScreen';
import { ar } from '../../i18n/ar';
import { fr } from '../../i18n/fr';
import { LANGUAGE_KEY, LanguageProvider } from '../../i18n/LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///rapport.pdf' })) }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(async () => undefined),
  moveAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));
/* eslint-disable @typescript-eslint/no-require-imports -- les fabriques de jest.mock chargent leurs dépendances */
jest.mock('expo-router', () => {
  const { useEffect: mockUseEffect } = require('react') as typeof import('react');
  return {
    router: { push: jest.fn(), dismissTo: jest.fn() },
    // Comme à l'ouverture de l'écran : l'effet de focus s'exécute une fois au montage.
    useFocusEffect: (effect: () => void) => mockUseEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { createElement } = require('react') as typeof import('react');
  const { View: MockView } = require('react-native') as typeof import('react-native');
  return { SafeAreaView: ({ children }: { children: ReactNode }) => createElement(MockView, null, children) };
});
jest.mock('@expo/vector-icons', () => {
  const { createElement } = require('react') as typeof import('react');
  const { Text: MockText } = require('react-native') as typeof import('react-native');
  return { Ionicons: ({ name }: { name: string }) => createElement(MockText, null, `[${name}]`) };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const printed = () => jest.mocked(Print.printToFileAsync).mock.calls.at(-1)?.[0]?.html ?? '';
/** Fichier effectivement partagé (après renommage). */
const shared = () => String(jest.mocked(Sharing.shareAsync).mock.calls.at(-1)?.[0] ?? '');
const STAMP = String.raw`\d{4}-\d{2}-\d{2}_\d{2}h\d{2}`;
const sharedAs = (module: string, patient: string) => new RegExp(`^file:///cache/NeuroCare_${module}_${patient}_${STAMP}\\.pdf$`);
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');

const press = (label: string) => fireEvent.press(screen.getByText(label));
const type = (label: string, value: string, index = 0) => fireEvent.changeText(screen.getAllByLabelText(label)[index], value);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(Print.printToFileAsync).mockClear();
  jest.mocked(Sharing.shareAsync).mockClear();
  jest.mocked(moveAsync).mockClear();
});

describe('accès direct depuis la grille, sans compte', () => {
  it('SpO2 : profil, alerte rouge avec appel des urgences, historique local et PDF', async () => {
    await render(<SaturationScreen />);
    expect(await screen.findByText(fr.spo2.profileQuestion)).toBeTruthy();
    expect(screen.queryByText(/Rappels & Suivi|code/i)).toBeNull();
    // Bandeau d'aide : oxymètre dessiné, pharmacie et conditions de mesure.
    expect(screen.getByText(fr.spo2.guide.title)).toBeTruthy();
    expect(screen.getByLabelText(fr.shared.devices.oximeter)).toBeTruthy();
    expect(screen.getByText(fr.spo2.guide.pharmacy)).toBeTruthy();
    expect(screen.getByText('Sans vernis à ongles ni faux ongles.')).toBeTruthy();

    await press('Non');
    await type('SpO2 (%)', '88');
    await type('Pouls (bpm)', '96');
    await press('Enregistrer la mesure');

    expect(await screen.findByText('Urgence : manque d’oxygène critique')).toBeTruthy();
    expect(screen.getByText('Appeler le 15')).toBeTruthy();
    expect(screen.getByText('Appeler le 141')).toBeTruthy();
    expect(await stored('neurocare.spo2.measures')).toHaveLength(1);

    await press('Télécharger le relevé SpO2 PDF');
    expect(printed()).toContain('Patient : <strong>Patient</strong>');
    expect(printed()).toContain('88 %');
    expect(printed()).toContain('<img src="data:image/png;base64,');
    expect(jest.mocked(moveAsync).mock.calls.at(-1)?.[0]).toEqual({ from: 'file:///rapport.pdf', to: shared() });
    expect(shared()).toMatch(sharedAs('Saturation-SpO2', 'Patient'));
  });

  it('Santé mentale : Mini-GDS à 0, arrêt, passation locale et PDF nominatif', async () => {
    await AsyncStorage.setItem(PATIENT_NAME_KEY, JSON.stringify('Fatima Z.'));
    await render(<MentalScreen />);
    expect(await screen.findByDisplayValue('Fatima Z.')).toBeTruthy();

    expect(screen.getByText(fr.gds.guide.conditions[1] as string)).toBeTruthy();
    expect(screen.getByText(fr.shared.guide.tips)).toBeTruthy();

    await press('Commencer');
    for (const answer of ['Non', 'Non', 'Oui', 'Non']) await press(answer); // découragé, vie vide, heureux, désespérée

    expect(await screen.findByText('Absence probable de dépression (Mini-GDS à 0)')).toBeTruthy();
    expect(await stored('neurocare.gds.assessments')).toHaveLength(1);

    await press('Télécharger le rapport GDS PDF');
    expect(printed()).toContain('Fatima Z.');
    expect(printed()).toContain('0 / 4');
    expect(shared()).toMatch(sharedAs('Sante-Mentale-GDS', 'Fatima-Z'));
  });

  it('Diabète : 8 réponses, IMC, score sur 26, bilan local et PDF', async () => {
    await render(<MetabolicScreen />);
    await screen.findByText('Questionnaire FINDRISC (8 questions)');
    expect(screen.getByLabelText(fr.shared.devices.metabolic)).toBeTruthy();
    expect(screen.getByText(/à jeun \(au moins 8 h sans manger\) ou 2 heures après le début du repas/)).toBeTruthy();

    await type('1. Âge (ans)', '60');
    await press('Homme');
    await type('2. Poids (kg)', '88');
    await type('Taille (cm ou m)', '1,75');
    expect(screen.getByText('IMC calculé : 28,7 kg/m²')).toBeTruthy();
    await type('3. Tour de taille (cm, au niveau du nombril)', '100');
    const yesNo = screen.getAllByRole('radio');
    // Groupes Oui / Non dans l'ordre : activité, fruits, médicaments HTA, glycémie (après Homme / Femme).
    await fireEvent.press(yesNo[3]); // activité : Non
    await fireEvent.press(yesNo[4]); // fruits : Oui
    await fireEvent.press(yesNo[6]); // médicaments : Oui
    await fireEvent.press(yesNo[9]); // glycémie : Non
    await press('Grand-parent, tante, oncle, cousin germain');
    await press('Calculer le score');

    expect(await screen.findByText('Score FINDRISC : 14 / 26')).toBeTruthy();
    expect(screen.getByText(/Risque modéré \(environ 17 %/)).toBeTruthy();
    expect(await stored('neurocare.findrisc.assessments')).toHaveLength(1);

    await press('Télécharger le bilan FINDRISC PDF');
    expect(printed()).toContain('14 / 26');
    expect(printed()).toContain('28,7 kg/m²');
    expect(shared()).toMatch(sharedAs('Diabete-FINDRISC', 'Patient'));
  });

  it('Tension : urgence avec check-list, protocole 3 jours local et PDF', async () => {
    await render(<CardioScreen />);
    await screen.findByText('Automesure sur 3 jours (18 mesures)');
    expect(screen.getByLabelText(fr.shared.devices.tensiometer)).toBeTruthy();
    expect(screen.getByText('SYS → TAS (grand chiffre)')).toBeTruthy();
    expect(screen.getByText(fr.bp.guide.pharmacy)).toBeTruthy();
    expect(screen.getByText('Le matin : avant le petit-déjeuner et avant la prise des médicaments.')).toBeTruthy();

    await type('TAS (grand chiffre)', '185');
    await type('TAD (petit chiffre)', '100');
    await type('Pouls (bpm)', '80');
    await press('Enregistrer la mesure');
    expect(await screen.findByText('Alerte rouge : tension très élevée (≥ 180/110)')).toBeTruthy();
    await press('Douleur dans la poitrine');
    expect(screen.getByText('Symptôme présent : appelez immédiatement les urgences.')).toBeTruthy();
    expect(screen.getByText('Appeler le 15')).toBeTruthy();

    await press('Démarrer le protocole (jour 1 = aujourd’hui)');
    expect(await screen.findByText(/Saisie : Jour 1 · Matin · M1/)).toBeTruthy();
    await type('TAS (grand chiffre)', '128', 0);
    await type('TAD (petit chiffre)', '78', 0);
    await type('Pouls (bpm)', '70', 0);
    await press('Enregistrer Jour 1 · Matin · M1');

    expect(await screen.findByText(/Saisie : Jour 1 · Matin · M2/)).toBeTruthy();
    expect(screen.getByText(/Moyenne provisoire \(1\/18\)/)).toBeTruthy();
    const [series] = await stored('neurocare.bp.series');
    expect(series.mesures).toHaveLength(1);

    await press('Télécharger le relevé d’automesure HTA PDF');
    expect(printed()).toContain('128/78');
    expect(shared()).toMatch(sharedAs('Tension-HTA', 'Patient'));
  });

  it('Alzheimer & Mémoire : 4 A, jeu des 4 mots, indice, bilan local et PDF', async () => {
    await AsyncStorage.setItem(PATIENT_NAME_KEY, JSON.stringify('Ahmed Benali'));
    await render(<AlzheimerScreen />);
    expect(await screen.findByDisplayValue('Ahmed Benali')).toBeTruthy();
    expect(screen.getByText(/lunettes et les appareils auditifs/)).toBeTruthy();
    await press('Commencer');
    // Un seul signe (amnésie) sur les 8 questions.
    for (const answer of ['Oui', 'Non', 'Non', 'Non', 'Non', 'Non', 'Non', 'Non']) await press(answer);

    expect(await screen.findByText('Horloge')).toBeTruthy();
    await press('J’ai retenu les 4 mots');
    await press(fr.memory.weekdays[weekdayOf(new Date())]);
    await press('17');
    await press('Continuer');
    await type('Mots retrouvés', 'citron, clef, horloge');
    await press('Valider mes mots');
    await fireEvent.press(screen.getByLabelText('Olivier'));
    await press('Voir le résultat');

    expect(await screen.findByText('Indice de vigilance cognitive : rassurant')).toBeTruthy();
    expect(screen.getByText('Amnésie (Mémoire récente) : 1 signe sur 2')).toBeTruthy();
    expect(screen.getByText(/Rappel des mots : 3 \/ 4 retrouvés, 1 reconnu/)).toBeTruthy();
    expect(screen.getByText(/^• Mémoire : un agenda/)).toBeTruthy();
    expect(await stored('neurocare.memory.assessments')).toHaveLength(1);

    await press('Télécharger le bilan Mémoire & 4 A PDF');
    expect(printed()).toContain('Patient : <strong>Ahmed Benali</strong>');
    expect(printed()).toContain('3 / 4');
    expect(printed()).toContain('Historique enregistré sur le téléphone');
    expect(shared()).toMatch(sharedAs('Alzheimer-4A', 'Ahmed-Benali'));
  });

  it('SpO2 en arabe : écran de droite à gauche, alerte et PDF en arabe (dir="rtl")', async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'ar');
    await render(
      <LanguageProvider>
        <SaturationScreen />
      </LanguageProvider>,
    );
    expect(await screen.findByText(ar.spo2.profileQuestion)).toBeTruthy();
    expect(screen.getByText(ar.common.home)).toBeTruthy();
    expect(screen.getByText(ar.spo2.guide.title)).toBeTruthy();
    expect(screen.getByLabelText(ar.shared.devices.oximeter)).toBeTruthy();
    expect(screen.getByText(ar.spo2.guide.pharmacy)).toBeTruthy();

    await press(ar.common.no);
    await type(ar.spo2.spo2Field, '88');
    await type(ar.spo2.pulseField, '96');
    await press(ar.spo2.save);

    expect(await screen.findByText(ar.spo2.advice('ROUGE', false).title)).toBeTruthy();
    expect(screen.getByText(ar.shared.call('15'))).toBeTruthy();

    await press(ar.spo2.download);
    expect(printed()).toContain('<html lang="ar" dir="rtl">');
    expect(printed()).toContain('المريض');
    expect(printed()).toContain('كشف تشبّع الدم بالأكسجين');
    // Nom par défaut « المريض » : le fichier porte « Patient ».
    expect(shared()).toMatch(sharedAs('Saturation-SpO2', 'Patient'));
  });
});
