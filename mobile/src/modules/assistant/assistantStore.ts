/**
 * Base de connaissances utilisée par l'assistant : la copie embarquée, ou une version plus récente reçue
 * du microservice `assistant-service` (port 8089) et gardée sur le téléphone. La synchronisation est
 * facultative : sans réseau, l'assistant fonctionne avec ce qu'il a.
 */
import { readJson, writeJson } from '../storage';
import { EMBEDDED_KB, compareVersions, isKnowledgeBase, type KnowledgeBase } from './knowledge';

export const KB_KEY = 'neurocare.assistant.knowledge';
export const ASSISTANT_PORT = 8089;
const SYNC_TIMEOUT_MS = 4000;

/** Origine de la base affichée : embarquée, à jour avec le serveur, mise à jour à l'instant, serveur injoignable. */
export type SyncStatus = 'embarquee' | 'a-jour' | 'mise-a-jour' | 'hors-ligne';

/** « http://192.168.1.19:8088/api/v1 » → « http://192.168.1.19:8089/api/v1/assistant » (même hôte, port du service). */
export function assistantBaseFrom(apiBase: string): string | null {
  const match = /^(https?:\/\/[^/:?#]+)/i.exec(apiBase.trim());
  return match ? `${match[1]}:${ASSISTANT_PORT}/api/v1/assistant` : null;
}

/** Base la plus récente disponible sur le téléphone (jamais plus ancienne que la copie embarquée). */
export async function loadKnowledge(): Promise<KnowledgeBase> {
  const cached = await readJson<unknown>(KB_KEY, null);
  return isKnowledgeBase(cached) && compareVersions(cached.version, EMBEDDED_KB.version) > 0 ? cached : EMBEDDED_KB;
}

/**
 * Demande au microservice une version plus récente (en-tête If-None-Match). Une base reçue n'est gardée
 * que si elle est bien formée et plus récente ; sinon la base courante reste en place.
 */
export async function syncKnowledge(apiBase: string, current: KnowledgeBase): Promise<{ kb: KnowledgeBase; status: SyncStatus }> {
  const base = assistantBaseFrom(apiBase);
  if (!base) return { kb: current, status: 'hors-ligne' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/knowledge`, {
      headers: { Accept: 'application/json', 'If-None-Match': `"${current.version}"` },
      signal: controller.signal,
    });
    if (response.status === 304) return { kb: current, status: 'a-jour' };
    if (!response.ok) return { kb: current, status: 'hors-ligne' };
    const received: unknown = await response.json();
    if (!isKnowledgeBase(received) || compareVersions(received.version, current.version) < 0) return { kb: current, status: 'hors-ligne' };
    if (compareVersions(received.version, current.version) === 0) return { kb: current, status: 'a-jour' };
    await writeJson(KB_KEY, received);
    return { kb: received, status: 'mise-a-jour' };
  } catch {
    return { kb: current, status: 'hors-ligne' };
  } finally {
    clearTimeout(timer);
  }
}
