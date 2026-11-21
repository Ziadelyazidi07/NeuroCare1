/**
 * Assistant Santé sur un téléphone sans réseau : puces, réponse sourcée lue à voix haute (débit ralenti),
 * urgence avec appel du 15 / 141, ouverture d'un module, dictée en darija, bandeau éthique permanent, et
 * bouton flottant de l'accueil (à droite, à gauche en arabe).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { router } from 'expo-router';

import ModulesHome from '../../../app/index';
import { ar } from '../../../i18n/ar';
import { fr } from '../../../i18n/fr';
import { LANGUAGE_KEY, LanguageProvider } from '../../../i18n/LanguageContext';
import AssistantScreen from '../AssistantScreen';

type Listener = (event: unknown) => void;
const mockListeners: Record<string, Listener> = {};

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => true),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    addListener: jest.fn((name: string, listener: Listener) => {
      mockListeners[name] = listener;
      return { remove: jest.fn() };
    }),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));
jest.mock('../../../auth/SessionContext', () => ({ useSession: () => ({ session: null, loading: false }) }));
jest.mock('../../../senior/reminders', () => ({ hasLaunchReminder: () => false }));
jest.mock('../../../api/config', () => ({ getApiBase: async () => 'http://192.168.1.19:8088/api/v1', setApiBase: jest.fn() }));
/* eslint-disable @typescript-eslint/no-require-imports -- les fabriques de jest.mock chargent leurs dépendances */
jest.mock('expo-router', () => {
  const { useEffect: mockUseEffect } = require('react') as typeof import('react');
  return {
    router: { push: jest.fn(), dismissTo: jest.fn() },
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

const press = (label: string) => fireEvent.press(screen.getByText(label));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(Speech.speak).mockClear();
  jest.mocked(router.push).mockClear();
});

describe('Assistant Santé hors ligne', () => {
  it('répond à une puce avec la source, lit la réponse lentement et ouvre le module Rappels', async () => {
    await render(<AssistantScreen />);
    expect(screen.getByText(fr.assistant.disclaimer)).toBeTruthy();
    expect(screen.getByText(/Base de connaissances 2026\.11\.\d+ · 100 % hors ligne/)).toBeTruthy();

    await press('J\'ai oublié mon médicament');
    expect(screen.getByText('Un médicament oublié')).toBeTruthy();
    expect(screen.getByText(/Ne prenez jamais deux doses en même temps/)).toBeTruthy();
    expect(screen.getByText(/^Source : OMS · HAS — /)).toBeTruthy();
    expect(Speech.speak).toHaveBeenCalledWith(expect.stringMatching(/^Un médicament oublié\. Pas d'inquiétude/), expect.objectContaining({ language: 'fr-FR', rate: 0.85 }));

    await press('Ouvrir « Rappels & Suivi »');
    expect(router.push).toHaveBeenCalledWith('/observance-role');
    // Lecture en cours, puis terminée : « Arrêter la lecture » devient « Réécouter ».
    await press(fr.assistant.stopListening);
    expect(screen.getByText(fr.assistant.relisten)).toBeTruthy();
    await press(fr.assistant.relisten);
    expect(Speech.speak).toHaveBeenCalledTimes(2);
  });

  it('signale l’urgence et propose l’appel du 15 et du 141 pour une douleur dans la poitrine', async () => {
    await render(<AssistantScreen />);
    await fireEvent.changeText(screen.getByLabelText(fr.assistant.inputLabel), 'j’ai mal à la poitrine depuis 20 minutes');
    await fireEvent.press(screen.getByLabelText(fr.assistant.send));
    expect(screen.getByText(fr.assistant.urgent)).toBeTruthy();
    expect(screen.getByText('Appeler le 15')).toBeTruthy();
    expect(screen.getByText('Appeler le 141')).toBeTruthy();
    expect(screen.getByText(/^Source : ESC — /)).toBeTruthy();
  });

  it('comprend la darija et répond en arabe, avec la source en arabe', async () => {
    await render(<AssistantScreen />);
    await press('عندي الدوخة');
    expect(screen.getByText('الدوار أو الدوخة')).toBeTruthy();
    expect(screen.getByText(/^المصدر: الهيئة العليا للصحة · /)).toBeTruthy();
    expect(Speech.speak).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ language: 'ar', rate: 0.85 }));
  });

  it('dicte une question en darija (ar-MA) puis y répond', async () => {
    await render(<AssistantScreen />);
    await press('الدارجة');
    await fireEvent.press(screen.getByLabelText(fr.assistant.micA11y));
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'ar-MA', interimResults: true }));
    expect(screen.getByText(fr.assistant.micListening)).toBeTruthy();
    await mockListeners.result?.({ isFinal: true, results: [{ transcript: 'نسيت الدوا', confidence: 0.9 }] });
    await mockListeners.end?.(null);
    expect(await screen.findByText('نسيان الدواء')).toBeTruthy();
  });

  it('propose « Écouter » quand la lecture automatique est coupée', async () => {
    await render(<AssistantScreen />);
    await fireEvent(screen.getByLabelText(fr.assistant.autoRead), 'valueChange', false);
    await press('Je dors mal');
    expect(Speech.speak).not.toHaveBeenCalled();
    await press(fr.assistant.listen);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('admet ne pas savoir et repropose des questions', async () => {
    await render(<AssistantScreen />);
    await fireEvent.changeText(screen.getByLabelText(fr.assistant.inputLabel), 'résultat du match de football');
    await fireEvent.press(screen.getByLabelText(fr.assistant.send));
    expect(screen.getByText(/Je n'ai pas trouvé de réponse précise/)).toBeTruthy();
  });
});

describe('bouton flottant de l’accueil', () => {
  it('ouvre l’assistant, en bas à droite en français', async () => {
    await render(
      <LanguageProvider>
        <ModulesHome />
      </LanguageProvider>,
    );
    const fab = await screen.findByLabelText(fr.assistant.fabA11y);
    expect(screen.getByText('Assistant Santé')).toBeTruthy();
    expect(StyleSheet.flatten(fab.props.style)).toMatchObject({ position: 'absolute', right: 16, backgroundColor: '#246BFD' });
    await fireEvent.press(fab);
    expect(router.push).toHaveBeenCalledWith('/assistant');
  });

  it('passe à gauche en arabe avec le libellé « المساعد الصحي »', async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'ar');
    await render(
      <LanguageProvider>
        <ModulesHome />
      </LanguageProvider>,
    );
    const fab = await screen.findByLabelText(ar.assistant.fabA11y);
    expect(screen.getByText('المساعد الصحي')).toBeTruthy();
    expect(StyleSheet.flatten(fab.props.style)).toMatchObject({ left: 16 });
  });
});
