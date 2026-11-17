/**
 * Mode hors ligne du senior (cahier §9.5, EF-RE-06, CA-10) :
 * - les prises des 48 h sont mises en cache pour afficher l'écran et programmer les rappels locaux ;
 * - une confirmation est d'abord enregistrée localement avec une clé unique, puis envoyée ;
 * - sans réseau, elle reste en file et part par POST /me/doses/sync au retour de la connexion.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { seniorApi } from '../api/api';
import type { DoseDto } from '../api/types';
import { ApiError } from '../lib/problem';
import {
  acknowledge,
  enqueue,
  withLocalConfirmations,
  type PendingConfirmation,
} from '../lib/offlineQueue';

const DOSES_KEY = 'neurocare.senior.doses';
const QUEUE_KEY = 'neurocare.senior.queue';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export async function cachedDoses(): Promise<DoseDto[]> {
  const [doses, queue] = await Promise.all([readJson<DoseDto[]>(DOSES_KEY, []), pendingQueue()]);
  return withLocalConfirmations(doses, queue);
}

export function pendingQueue(): Promise<PendingConfirmation[]> {
  return readJson<PendingConfirmation[]>(QUEUE_KEY, []);
}

/** Recharge les prises depuis le serveur (après avoir envoyé la file) ; renvoie le cache si hors ligne. */
export async function refreshDoses(): Promise<{ doses: DoseDto[]; online: boolean }> {
  try {
    await flushQueue();
    const doses = await seniorApi.upcomingDoses(48);
    await AsyncStorage.setItem(DOSES_KEY, JSON.stringify(doses));
    return { doses: withLocalConfirmations(doses, await pendingQueue()), online: true };
  } catch (error) {
    if (error instanceof ApiError && !error.isNetwork) throw error;
    return { doses: await cachedDoses(), online: false };
  }
}

/**
 * « C'est fait » : enregistré localement d'abord (rien n'est perdu sans réseau), puis envoyé avec
 * l'en-tête Idempotency-Key. Une même clé rejouée donne la même réponse côté serveur (CA-04).
 */
export async function confirmDose(dose: DoseDto): Promise<'envoyee' | 'en_attente' | 'refusee'> {
  const item: PendingConfirmation = {
    doseId: dose.id,
    clientRequestId: Crypto.randomUUID(),
    horodatageClient: new Date().toISOString(),
  };
  const queue = enqueue(await pendingQueue(), item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  const queued = queue.find((q) => q.doseId === dose.id) ?? item;
  try {
    await seniorApi.confirm(queued.doseId, queued.clientRequestId, queued.horodatageClient);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.doseId !== dose.id)));
    return 'envoyee';
  } catch (error) {
    if (error instanceof ApiError && error.isNetwork) return 'en_attente';
    // 409 (déjà clôturée) ou 404 : définitif, on retire de la file.
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((q) => q.doseId !== dose.id)));
    return 'refusee';
  }
}

/** Envoie les confirmations faites hors ligne ; chaque élément est traité séparément par le serveur. */
export async function flushQueue(): Promise<number> {
  const queue = await pendingQueue();
  if (queue.length === 0) return 0;
  const response = await seniorApi.sync(queue);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(acknowledge(await pendingQueue(), response.resultats)));
  return response.resultats.length;
}

export async function clearSeniorData(): Promise<void> {
  await AsyncStorage.multiRemove([DOSES_KEY, QUEUE_KEY]);
}
