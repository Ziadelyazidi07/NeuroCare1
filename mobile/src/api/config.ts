/**
 * Adresse du backend. Ordre de priorité : valeur saisie dans l'application, puis EXPO_PUBLIC_API_URL,
 * puis http://localhost:8088/api/v1 (stack docker compose sur le poste).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_API_BASE, cleanApiBase } from '../lib/urls';

const KEY = 'neurocare.apiBase';
let cached: string | null = null;

export function defaultApiBase(): string {
  return cleanApiBase(process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE);
}

export async function getApiBase(): Promise<string> {
  if (cached) return cached;
  const stored = await AsyncStorage.getItem(KEY);
  cached = stored ? cleanApiBase(stored) : defaultApiBase();
  return cached;
}

export async function setApiBase(url: string): Promise<void> {
  cached = cleanApiBase(url);
  await AsyncStorage.setItem(KEY, cached);
}
