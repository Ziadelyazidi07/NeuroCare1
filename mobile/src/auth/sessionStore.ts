/**
 * Session persistée dans le stockage sécurisé du téléphone (Keychain / Keystore) : jetons JWT de
 * l'aidant ou token d'appareil du senior. Jamais en clair dans AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store';

export type Session =
  | {
      kind: 'aidant';
      accessToken: string;
      refreshToken: string;
      /** Instant (ms) d'expiration du jeton d'accès. */
      accessExpiresAt: number;
      userId: string;
      nomComplet: string;
    }
  | { kind: 'senior'; deviceToken: string; seniorId: string; nomComplet: string };

const KEY = 'neurocare.session';
let current: Session | null = null;
const listeners = new Set<(session: Session | null) => void>();

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  current = raw ? (JSON.parse(raw) as Session) : null;
  return current;
}

export function getSession(): Session | null {
  return current;
}

export async function saveSession(session: Session | null): Promise<void> {
  current = session;
  if (session) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
  listeners.forEach((listener) => listener(session));
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
