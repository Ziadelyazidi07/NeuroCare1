/** Temps réel du mode démo : les changements du serveur local sont diffusés dans l'application (sans réseau). */
import type { RealtimeEvent } from '../api/types';

const listeners = new Set<(event: RealtimeEvent) => void>();

export function emitDemoEvent(event: RealtimeEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function onDemoEvent(listener: (event: RealtimeEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
