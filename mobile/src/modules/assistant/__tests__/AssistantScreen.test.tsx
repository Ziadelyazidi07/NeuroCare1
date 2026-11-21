/// <reference types="node" />
/**
 * Assistant Santé « Senior-First » sur un écran unique sans défilement : accueil (consigne + 4 sujets),
 * une seule carte de réponse à la fois (résumé, Écouter / Réécouter, action utile, autre question, source),
 * son activé / coupé, langues FR | العربية | الدارجة, grand micro avec pulsation, saisie au clavier à la
 * demande, et bouton flottant de l'accueil (à droite, à gauche en arabe).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { router } from 'expo-router';

import ModulesHome from '../../../app/index';
import { ar } from '../../../i18n/ar';
import { fr } from '../../../i18n/fr';
import { LANGUAGE_KEY, LanguageProvider } from '../../../i18n/LanguageContext';
import AssistantScreen, { BUTTON_HEIGHT, HOME_TOPICS, MIC_SIZE } from '../AssistantScreen';
import { EMBEDDED_KB } from '../knowledge';

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
  return { SafeAreaView: ({ children, testID }: { children: ReactNode; testID?: string }) => createElement(MockView, { testID }, children) };
});
jest.mock('@expo/vector-icons', () => {
  const { createElement } = require('react') as typeof import('react');
  const { Text: MockText } = require('react-native') as typeof import('react-native');
  return { Ionicons: ({ name }: { name: string }) => createElement(MockText, null, `[${name}]`) };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const press = (label: string) => fireEvent.press(screen.getByText(label));
const topic = (id: string) => {
  const found = EMBEDDED_KB.topics.find((t) => t.id === id);
  if (!found) throw new Error(`fiche ${id} attendue`);
  return found;
};
const inLanguage = (children: ReactNode) => <LanguageProvider>{children}</LanguageProvider>;
const askByKeyboard = async (question: string) => {
  await press(fr.assistant.write);
  await fireEvent.changeText(screen.getByLabelText(fr.assistant.inputLabel), question);
  await press(fr.assistant.send);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(Speech.speak).mockClear();
  jest.mocked(router.push).mockClear();
  jest.mocked(router.dismissTo).mockClear();
  jest.mocked(ExpoSpeechRecognitionModule.isRecognitionAvailable).mockReturnValue(true);
});

describe('écran unique, sans défilement', () => {
  it('n’utilise aucune liste défilante, ni à l’accueil ni sur une réponse', async () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'AssistantScreen.tsx'), 'utf8');
    expect(source).not.toMatch(/ScrollView|FlatList|SectionList/);
    // Les zones haute, centrale, éthique et basse sont toujours présentes, sans conteneur défilant.
    await render(<AssistantScreen />);
    for (const id of ['assistant-top', 'assistant-center', 'assistant-ethics', 'assistant-bottom']) expect(screen.getByTestId(id)).toBeTruthy();
    await press(EMBEDDED_KB.suggestions.fr[0] as string);
    expect(screen.getByTestId('assistant-card')).toBeTruthy();
    expect(screen.getByTestId('assistant-bottom')).toBeTruthy();
  });

  it('respecte les tailles senior : micro ≥ 76 dp, boutons ≥ 56 dp, 4 sujets', async () => {
    expect(MIC_SIZE).toBeGreaterThanOrEqual(76);
    expect(BUTTON_HEIGHT).toBeGreaterThanOrEqual(56);
    expect(HOME_TOPICS).toBe(4);
    await render(<AssistantScreen />);
    expect(StyleSheet.flatten(screen.getByTestId('assistant-mic').props.style)).toMatchObject({ width: MIC_SIZE, height: MIC_SIZE, backgroundColor: '#246BFD' });
  });
});

describe('accueil de l’assistant', () => {
  it('affiche la consigne, 4 gros sujets, le micro « Parler », « Écrire », la langue et le son', async () => {
    await render(<AssistantScreen />);
    expect(screen.getByText(fr.assistant.instruction)).toBeTruthy();
    for (const question of EMBEDDED_KB.suggestions.fr.slice(0, HOME_TOPICS)) expect(screen.getByText(question)).toBeTruthy();
    expect(screen.queryByText(EMBEDDED_KB.suggestions.fr[HOME_TOPICS] as string)).toBeNull();
    expect(screen.getByText(fr.assistant.talk)).toBeTruthy();
    expect(screen.getByText(fr.assistant.write)).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityState?.selected)).toEqual([true, false, false]);
    expect(screen.getByText(fr.assistant.soundOn)).toBeTruthy();
    expect(screen.getByText(fr.assistant.ethicsShort)).toBeTruthy();
    expect(screen.getByLabelText(fr.assistant.disclaimer)).toBeTruthy();
    // Le clavier n'apparaît qu'à la demande.
    expect(screen.queryByLabelText(fr.assistant.inputLabel)).toBeNull();
  });

  it('le grand bouton Retour revient à l’accueil des modules', async () => {
    await render(<AssistantScreen />);
    await press(fr.assistant.back);
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });
});

describe('une seule carte de réponse', () => {
  it('remplace l’accueil par le résumé, lit l’explication complète, puis « Réécouter » et « Poser une autre question »', async () => {
    await render(<AssistantScreen />);
    const t = topic('oubli-medicament');
    await press("J'ai oublié mon médicament");

    expect(screen.getByText(t.title.fr)).toBeTruthy();
    expect(screen.getByText(t.summary.fr)).toBeTruthy();
    expect(screen.queryByText(t.answer.fr)).toBeNull();
    expect(screen.queryByText(fr.assistant.instruction)).toBeNull();
    expect(screen.getByText('Source : OMS · HAS')).toBeTruthy();
    expect(Speech.speak).toHaveBeenCalledWith(`${t.title.fr}. ${t.answer.fr}`, expect.objectContaining({ language: 'fr-FR', rate: 0.85 }));

    await press(fr.assistant.stopListening);
    await press(fr.assistant.relisten);
    expect(Speech.speak).toHaveBeenCalledTimes(2);

    await press('Ouvrir « Rappels & Suivi »');
    expect(router.push).toHaveBeenCalledWith('/observance-role');

    await press(fr.assistant.another);
    expect(screen.getByText(fr.assistant.instruction)).toBeTruthy();
    expect(screen.queryByTestId('assistant-card')).toBeNull();
  });

  it('ne garde jamais d’historique : la nouvelle réponse remplace la précédente', async () => {
    await render(<AssistantScreen />);
    await press('Ma tension est élevée');
    await press(fr.assistant.another);
    await press('Mon sucre est trop bas');
    expect(screen.getAllByTestId('assistant-card')).toHaveLength(1);
    expect(screen.queryByText(topic('hta-elevee').title.fr)).toBeNull();
  });

  it('urgence : titre en rouge et appels 15 / 141 en rouge, sans autre action', async () => {
    await render(<AssistantScreen />);
    await askByKeyboard('j’ai mal à la poitrine depuis 20 minutes');
    const title = screen.getByText(topic('urgence-douleur-poitrine').title.fr);
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({ color: '#C62828' });
    expect(title.props.accessibilityLabel).toMatch(/^Signe de gravité possible/);
    expect(screen.getByText('Appeler le 15')).toBeTruthy();
    expect(screen.getByText('Appeler le 141')).toBeTruthy();
    expect(screen.queryByText(/^Ouvrir « /)).toBeNull();
    expect(screen.getByText('Source : ESC')).toBeTruthy();
  });

  it('admet ne pas savoir, sans source ni action inventée', async () => {
    await render(<AssistantScreen />);
    await askByKeyboard('résultat du match de football');
    expect(screen.getByText(EMBEDDED_KB.fallback.fr)).toBeTruthy();
    expect(screen.queryByText(/^Source/)).toBeNull();
    expect(screen.getByText(fr.assistant.another)).toBeTruthy();
  });
});

describe('son, langues et micro', () => {
  it('son coupé : pas de lecture automatique, « Écouter » reste disponible', async () => {
    await render(<AssistantScreen />);
    await press(fr.assistant.soundOn);
    expect(screen.getByText(fr.assistant.soundOff)).toBeTruthy();
    await press('Mon sucre est trop bas');
    expect(Speech.speak).not.toHaveBeenCalled();
    await press(fr.assistant.listen);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('darija : sujets en darija, dictée ar-MA avec pulsation du micro, réponse et source en arabe', async () => {
    await render(inLanguage(<AssistantScreen />));
    await press('الدارجة');
    expect(screen.getByText(ar.assistant.instruction)).toBeTruthy();
    for (const question of EMBEDDED_KB.suggestions.darija.slice(0, HOME_TOPICS)) expect(screen.getByText(question)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(ar.assistant.micA11y));
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'ar-MA', interimResults: true }));
    expect(screen.getByTestId('mic-pulse')).toBeTruthy();
    expect(screen.getByText(ar.assistant.stopTalk)).toBeTruthy();
    await act(async () => mockListeners.result?.({ isFinal: false, results: [{ transcript: 'نسيت الدوا', confidence: 0.9 }] }));
    expect(screen.getByText('«نسيت الدوا»')).toBeTruthy();
    await act(async () => mockListeners.result?.({ isFinal: true, results: [{ transcript: 'نسيت الدوا', confidence: 0.9 }] }));
    await act(async () => mockListeners.end?.(null));

    expect(await screen.findByText(topic('oubli-medicament').title.ar)).toBeTruthy();
    expect(screen.getByText('المصدر: منظمة الصحة العالمية · الهيئة العليا للصحة')).toBeTruthy();
    expect(screen.queryByTestId('mic-pulse')).toBeNull();
    expect(Speech.speak).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ language: 'ar', rate: 0.85 }));
  });

  it('micro indisponible : message clair qui renvoie vers « Écrire »', async () => {
    jest.mocked(ExpoSpeechRecognitionModule.isRecognitionAvailable).mockReturnValue(false);
    await render(<AssistantScreen />);
    await fireEvent.press(screen.getByLabelText(fr.assistant.micA11y));
    expect(screen.getByText(fr.assistant.micUnavailable)).toBeTruthy();
  });

  it('« Écrire » ouvre le champ, masque le micro, et « Annuler » revient à l’accueil', async () => {
    await render(<AssistantScreen />);
    await press(fr.assistant.write);
    expect(screen.getByLabelText(fr.assistant.inputLabel)).toBeTruthy();
    expect(screen.queryByTestId('assistant-mic')).toBeNull();
    await press(fr.assistant.cancel);
    expect(screen.getByTestId('assistant-mic')).toBeTruthy();
    expect(screen.getByText(fr.assistant.instruction)).toBeTruthy();
  });
});

describe('bouton flottant de l’accueil', () => {
  it('ouvre l’assistant, en bas à droite en français', async () => {
    await render(inLanguage(<ModulesHome />));
    const fab = await screen.findByLabelText(fr.assistant.fabA11y);
    expect(screen.getByText('Assistant Santé')).toBeTruthy();
    expect(StyleSheet.flatten(fab.props.style)).toMatchObject({ position: 'absolute', right: 16, backgroundColor: '#246BFD' });
    await fireEvent.press(fab);
    expect(router.push).toHaveBeenCalledWith('/assistant');
  });

  it('passe à gauche en arabe avec le libellé « المساعد الصحي »', async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'ar');
    await render(inLanguage(<ModulesHome />));
    const fab = await screen.findByLabelText(ar.assistant.fabA11y);
    expect(screen.getByText('المساعد الصحي')).toBeTruthy();
    expect(StyleSheet.flatten(fab.props.style)).toMatchObject({ left: 16 });
  });
});
