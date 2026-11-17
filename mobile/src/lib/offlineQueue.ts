/**
 * File des confirmations faites hors ligne (cahier §9.5, EF-RE-06) — logique pure, sans stockage.
 * Chaque confirmation porte une clé client unique : le backend la traite de façon idempotente.
 */
import type { DoseLike } from './doses';

export interface PendingConfirmation {
  doseId: string;
  clientRequestId: string;
  horodatageClient: string;
}

export type SyncOutcome = 'APPLIQUEE' | 'DEJA_APPLIQUEE' | 'REFUSEE' | 'INTROUVABLE';

export interface SyncItemResult {
  doseId: string;
  clientRequestId: string;
  resultat: SyncOutcome;
  statut?: string;
}

/** Ajoute une confirmation ; une prise déjà en file n'est pas dupliquée (la première action compte). */
export function enqueue(queue: PendingConfirmation[], item: PendingConfirmation): PendingConfirmation[] {
  return queue.some((q) => q.doseId === item.doseId) ? queue : [...queue, item];
}

/** Retire de la file les éléments traités par le serveur, quel que soit le résultat (définitif). */
export function acknowledge(queue: PendingConfirmation[], results: SyncItemResult[]): PendingConfirmation[] {
  const done = new Set(results.map((r) => r.clientRequestId));
  return queue.filter((q) => !done.has(q.clientRequestId));
}

/** Affiche localement comme confirmées les prises encore en file (l'écran reste juste hors ligne). */
export function withLocalConfirmations<T extends DoseLike>(doses: T[], queue: PendingConfirmation[]): T[] {
  const queued = new Set(queue.map((q) => q.doseId));
  return doses.map((d) => (queued.has(d.id) && d.statut === 'EN_ATTENTE' ? { ...d, statut: 'CONFIRME' } : d));
}
