/**
 * Stockage local des modules cliniques (2 à 6) : tout reste sur le téléphone, sans compte ni réseau.
 * Les écritures sont sérialisées pour qu'une lecture-modification-écriture n'en écrase pas une autre.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Nombre maximal d'éléments conservés par historique. */
export const MAX_HISTORY = 500;

let queue: Promise<unknown> = Promise.resolve();

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback; // donnée illisible : on repart d'un historique vide plutôt que de bloquer le module
  }
}

export function writeJson(key: string, value: unknown): Promise<void> {
  const run = queue.then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
  queue = run.catch(() => undefined);
  return run;
}

/** Lit, transforme puis réécrit une valeur, sans entrelacement avec une autre écriture. */
export function updateJson<T, R>(key: string, fallback: T, change: (value: T) => { value: T; result: R }): Promise<R> {
  const run = queue.then(async () => {
    const { value, result } = change(await readJson(key, fallback));
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Ajoute en tête (le plus récent d'abord) et borne la taille de l'historique. */
export function prepend<T>(list: T[], item: T): T[] {
  return [item, ...list].slice(0, MAX_HISTORY);
}
