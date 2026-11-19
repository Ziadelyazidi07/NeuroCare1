import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { clearSavedCredentials, loadSavedCredentials, saveCredentials } from '../savedCredentials';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockStore.set(key, value),
  deleteItemAsync: async (key: string) => void mockStore.delete(key),
}));

describe('identifiants mémorisés', () => {
  beforeEach(() => mockStore.clear());

  it('restitue les identifiants enregistrés', async () => {
    await saveCredentials({ telephone: '+212600000001', motDePasse: 'secret-123' });
    await expect(loadSavedCredentials()).resolves.toEqual({ telephone: '+212600000001', motDePasse: 'secret-123' });
  });

  it("n'a plus rien après effacement", async () => {
    await saveCredentials({ telephone: '+212600000001', motDePasse: 'secret-123' });
    await clearSavedCredentials();
    await expect(loadSavedCredentials()).resolves.toBeNull();
  });

  it('ignore une valeur illisible', async () => {
    mockStore.set('neurocare.aidant.credentials', '{pas du json');
    await expect(loadSavedCredentials()).resolves.toBeNull();
  });
});
