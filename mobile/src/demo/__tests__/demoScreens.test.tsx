/**
 * Démonstration sans serveur : la connexion aidant échoue (« Serveur injoignable »), le bloc de secours
 * s'ouvre, l'adresse du serveur se modifie sur place et le mode démo ouvre l'espace aidant sans réseau.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import AidantLogin from '../../app/aidant/login';
import { SessionProvider } from '../../auth/SessionContext';
import { getSession, saveSession } from '../../auth/sessionStore';
import { getApiBase } from '../../api/config';
import { aidantApi } from '../../api/api';
import { fr } from '../../i18n/fr';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('../../senior/reminderAudio', () => ({ clearReminderAudio: jest.fn() }));
jest.mock('../../senior/reminders', () => ({ cancelReminders: jest.fn(async () => undefined) }));
jest.mock('../../senior/offlineStore', () => ({ clearSeniorData: jest.fn(async () => undefined), flushQueue: jest.fn(async () => 0) }));
/* eslint-disable @typescript-eslint/no-require-imports -- les fabriques de jest.mock chargent leurs dépendances */
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
jest.mock('@expo/vector-icons', () => {
  const { createElement } = require('react') as typeof import('react');
  const { Text: MockText } = require('react-native') as typeof import('react-native');
  return { Ionicons: ({ name }: { name: string }) => createElement(MockText, null, `[${name}]`) };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const press = (label: string) => fireEvent.press(screen.getByText(label));
const wrap = (children: ReactNode) => <SessionProvider>{children}</SessionProvider>;

beforeEach(async () => {
  await AsyncStorage.clear();
  await saveSession(null);
  jest.mocked(router.replace).mockClear();
});

describe('connexion aidant sans serveur', () => {
  it('propose le mode démo hors ligne quand le serveur est injoignable, puis ouvre l’espace aidant', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await render(wrap(<AidantLogin />));
    expect(screen.getByText(fr.demo.button)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText(fr.login.phone), '0612345678');
    await fireEvent.changeText(screen.getByLabelText(fr.login.password), 'motdepasse1');
    await press(fr.login.signIn);

    expect(await screen.findByText(fr.errors.network)).toBeTruthy();
    expect(screen.getByText(fr.demo.unreachable)).toBeTruthy();

    // Nouvelle adresse saisie sur place, sans recompiler.
    await fireEvent.changeText(screen.getByLabelText(fr.demo.server.label), 'http://192.168.1.50:8088/api/v1/');
    await press(fr.demo.server.save);
    expect(await getApiBase()).toBe('http://192.168.1.50:8088/api/v1');
    expect(await screen.findByText(fr.demo.server.saved('http://192.168.1.50:8088/api/v1'))).toBeTruthy();

    fetchMock.mockClear();
    await press(fr.demo.asAidant);
    expect(router.replace).toHaveBeenCalledWith('/aidant');
    expect(getSession()).toMatchObject({ kind: 'aidant', demo: true });
    expect((await aidantApi.seniors())[0]?.nomComplet).toBe('Hajja Zahra');
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('ouvre aussi le mode démo depuis le lien discret, côté senior', async () => {
    await render(wrap(<AidantLogin />));
    await press(fr.demo.button);
    await press(fr.demo.asSenior);
    expect(router.replace).toHaveBeenCalledWith('/senior');
    expect(getSession()).toMatchObject({ kind: 'senior', demo: true, nomComplet: 'Hajja Zahra' });
  });
});
