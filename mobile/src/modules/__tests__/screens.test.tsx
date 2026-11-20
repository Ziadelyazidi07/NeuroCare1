/**
 * Les 4 modules cliniques montés comme sur un téléphone vierge : aucune session, aucun appairage, aucun
 * serveur. Chacun s'ouvre, calcule son alerte ou son score, mémorise l'historique et produit son PDF.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';

import CardioScreen from '../cardio/CardioScreen';
import MentalScreen from '../mental/MentalScreen';
import MetabolicScreen from '../metabolic/MetabolicScreen';
import { PATIENT_NAME_KEY } from '../PatientName';
import SaturationScreen from '../saturation/SaturationScreen';
import { PROFILE_QUESTION } from '../saturation/spo2';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///rapport.pdf' })) }));
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
const stored = async (key: string) => JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');

const press = (label: string) => fireEvent.press(screen.getByText(label));
const type = (label: string, value: string, index = 0) => fireEvent.changeText(screen.getAllByLabelText(label)[index], value);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(Print.printToFileAsync).mockClear();
});

describe('accès direct depuis la grille, sans compte', () => {
  it('SpO2 : profil, alerte rouge avec appel des urgences, historique local et PDF', async () => {
    await render(<SaturationScreen />);
    expect(await screen.findByText(PROFILE_QUESTION)).toBeTruthy();
    expect(screen.queryByText(/Rappels & Suivi|code/i)).toBeNull();

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
  });

  it('Santé mentale : Mini-GDS à 0, arrêt, passation locale et PDF nominatif', async () => {
    await AsyncStorage.setItem(PATIENT_NAME_KEY, JSON.stringify('Fatima Z.'));
    await render(<MentalScreen />);
    expect(await screen.findByDisplayValue('Fatima Z.')).toBeTruthy();

    await press('Commencer');
    for (const answer of ['Non', 'Non', 'Oui', 'Non']) await press(answer); // découragé, vie vide, heureux, désespérée

    expect(await screen.findByText('Absence probable de dépression (Mini-GDS à 0)')).toBeTruthy();
    expect(await stored('neurocare.gds.assessments')).toHaveLength(1);

    await press('Télécharger le rapport GDS PDF');
    expect(printed()).toContain('Fatima Z.');
    expect(printed()).toContain('0 / 4');
  });

  it('Diabète : 8 réponses, IMC, score sur 26, bilan local et PDF', async () => {
    await render(<MetabolicScreen />);
    await screen.findByText('Questionnaire FINDRISC (8 questions)');

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
  });

  it('Tension : urgence avec check-list, protocole 3 jours local et PDF', async () => {
    await render(<CardioScreen />);
    await screen.findByText('Automesure sur 3 jours (18 mesures)');

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
  });
});
