/**
 * Identifiants de l'aidant mémorisés à sa demande, dans le stockage sécurisé du téléphone
 * (Keychain / Keystore), jamais dans AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store';

export interface SavedCredentials {
  telephone: string;
  motDePasse: string;
}

const KEY = 'neurocare.aidant.credentials';

export async function loadSavedCredentials(): Promise<SavedCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedCredentials>;
    return typeof value.telephone === 'string' && typeof value.motDePasse === 'string'
      ? { telephone: value.telephone, motDePasse: value.motDePasse }
      : null;
  } catch {
    return null;
  }
}

export async function saveCredentials(credentials: SavedCredentials): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(credentials));
}

export async function clearSavedCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
