/**
 * Traduction français / arabe : dictionnaires complets et de même forme, bascule instantanée depuis l'accueil
 * (sans redémarrage), sens droite-à-gauche et mémorisation du choix sur le téléphone.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ModulesHome from '../../app/index';
import { ar } from '../ar';
import { fr } from '../fr';
import { LANGUAGE_KEY, LanguageProvider } from '../LanguageContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../auth/SessionContext', () => ({ useSession: () => ({ session: null, loading: false }) }));
jest.mock('../../api/config', () => ({ getApiBase: async () => 'http://192.168.1.19:8088/api/v1', setApiBase: async () => undefined }));
jest.mock('../../senior/reminders', () => ({ hasLaunchReminder: () => false }));
/* eslint-disable @typescript-eslint/no-require-imports -- les fabriques de jest.mock chargent leurs dépendances */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), dismissTo: jest.fn() }, Redirect: () => null }));
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

type Shape = string | number | boolean | null | Shape[] | { [key: string]: Shape } | ((...args: never[]) => unknown);

/** Forme d'une valeur du dictionnaire : type de chaque feuille, longueur des listes, clés des objets. */
function shape(value: unknown, key = ''): Shape {
  if (typeof value === 'function') return `fonction/${value.length}`;
  // Formes acceptées au rappel libre : leur nombre dépend de la langue.
  if (key === 'forms' && value && typeof value === 'object') return Object.keys(value).sort();
  if (Array.isArray(value)) return value.map((v) => shape(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, shape((value as Record<string, unknown>)[k], k)]));
  }
  return typeof value;
}

function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('dictionnaires', () => {
  it('ont exactement la même forme en français et en arabe', () => {
    expect(shape(ar)).toEqual(shape(fr));
  });

  it('n’ont aucun texte vide et l’arabe est bien écrit en arabe', () => {
    const arabic = /[؀-ۿ]/;
    // Libellés identiques dans les deux langues : codes, unités et noms d'échelles.
    const neutral = /^(ltr|rtl|ar|PDF|NeuroCare|SpO2 \(%\)|SpO2|#|Mini-GDS|GDS-15|, |cle|clef|citron|horloge|olivier)$/;
    for (const [path, text] of strings(ar)) {
      expect({ path, empty: text.trim() === '' }).toEqual({ path, empty: false });
      if (!neutral.test(text)) expect({ path, arabic: arabic.test(text) }).toEqual({ path, arabic: true });
    }
  });

  it('gardent la mention de non-diagnostic dans les deux langues', () => {
    expect(fr.shared.notADiagnosis).toContain('ne constitue pas un diagnostic médical officiel');
    expect(ar.shared.notADiagnosis).toContain('ليست تشخيصًا طبيًا رسميًا');
  });
});

describe('sélecteur de langue de l’accueil', () => {
  it('passe toute la grille en arabe, de droite à gauche, sans redémarrage, et mémorise le choix', async () => {
    await render(
      <LanguageProvider>
        <ModulesHome />
      </LanguageProvider>,
    );
    expect(await screen.findByText('Alzheimer & Mémoire')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Français' }).props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));

    expect(await screen.findByText('الزهايمر والذاكرة')).toBeTruthy();
    expect(screen.queryByText('Alzheimer & Mémoire')).toBeNull();
    for (const module of Object.values(ar.home.modules)) expect(screen.getByText(module.title)).toBeTruthy();
    const title = StyleSheet.flatten(screen.getByText(ar.home.subtitle).props.style);
    expect(title).toMatchObject({ writingDirection: 'rtl', textAlign: 'right' });
    expect(await AsyncStorage.getItem(LANGUAGE_KEY)).toBe('ar');

    await fireEvent.press(screen.getByRole('radio', { name: 'Français' }));
    expect(await screen.findByText('Alzheimer & Mémoire')).toBeTruthy();
    expect(await AsyncStorage.getItem(LANGUAGE_KEY)).toBe('fr');
  });

  it('rouvre l’application dans la langue mémorisée', async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, 'ar');
    await render(
      <LanguageProvider>
        <ModulesHome />
      </LanguageProvider>,
    );
    expect(await screen.findByText('التذكيرات والمتابعة')).toBeTruthy();
    expect(screen.getByText(ar.home.ethics)).toBeTruthy();
  });
});
