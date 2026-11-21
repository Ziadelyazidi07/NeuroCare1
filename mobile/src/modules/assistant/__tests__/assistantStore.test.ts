import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KB_KEY, assistantBaseFrom, loadKnowledge, syncKnowledge } from '../assistantStore';
import { EMBEDDED_KB, type KnowledgeBase } from '../knowledge';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const API = 'http://192.168.1.19:8088/api/v1';
const newer: KnowledgeBase = { ...EMBEDDED_KB, version: '2099.1.1' };
const respond = (status: number, body?: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body } as Response);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('adresse du microservice', () => {
  it('reprend l’hôte du serveur avec le port 8089', () => {
    expect(assistantBaseFrom(API)).toBe('http://192.168.1.19:8089/api/v1/assistant');
    expect(assistantBaseFrom('https://neurocare.example/api/v1')).toBe('https://neurocare.example:8089/api/v1/assistant');
    expect(assistantBaseFrom('pas une url')).toBeNull();
  });
});

describe('synchronisation facultative', () => {
  it('utilise la base embarquée sans réseau', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    const kb = await loadKnowledge();
    expect(kb).toBe(EMBEDDED_KB);
    await expect(syncKnowledge(API, kb)).resolves.toEqual({ kb, status: 'hors-ligne' });
  });

  it('garde une version plus récente du serveur et la relit hors ligne', async () => {
    const fetchMock = respond(200, newer);
    await expect(syncKnowledge(API, EMBEDDED_KB)).resolves.toEqual({ kb: newer, status: 'mise-a-jour' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://192.168.1.19:8089/api/v1/assistant/knowledge');
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['If-None-Match']).toBe(`"${EMBEDDED_KB.version}"`);
    expect((await loadKnowledge()).version).toBe('2099.1.1');
  });

  it('reste sur sa base si le serveur répond 304 ou envoie une base mal formée', async () => {
    respond(304);
    await expect(syncKnowledge(API, EMBEDDED_KB)).resolves.toEqual({ kb: EMBEDDED_KB, status: 'a-jour' });
    respond(200, { version: '2099.1.1', topics: [{ id: 'x' }] });
    await expect(syncKnowledge(API, EMBEDDED_KB)).resolves.toEqual({ kb: EMBEDDED_KB, status: 'hors-ligne' });
    expect(await AsyncStorage.getItem(KB_KEY)).toBeNull();
  });

  it('ignore une base gardée plus ancienne que la copie embarquée', async () => {
    await AsyncStorage.setItem(KB_KEY, JSON.stringify({ ...EMBEDDED_KB, version: '2020.1.1' }));
    expect(await loadKnowledge()).toBe(EMBEDDED_KB);
  });
});
