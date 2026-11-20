/**
 * Client HTTP de l'API. Ajoute l'en-tête Authorization (JWT aidant ou token d'appareil senior),
 * rafraîchit le jeton de l'aidant une fois en cas de 401 (rotation, cahier §8.1) et convertit les
 * erreurs RFC 7807 en {@link ApiError}.
 */
import { getSession, isDemoSession, saveSession, type Session } from '../auth/sessionStore';
import { demoRequest } from '../demo/demoBackend';
import { ApiError, networkError, toApiError } from '../lib/problem';
import { getApiBase } from './config';
import type { AuthResponse } from './types';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  /** Corps multipart déjà construit (upload de la voix). */
  form?: FormData;
  headers?: Record<string, string>;
  /** false : requête publique (connexion, appairage). */
  auth?: boolean;
}

/** Marge avant expiration à partir de laquelle le jeton d'accès est renouvelé par anticipation. */
const REFRESH_MARGIN_MS = 60_000;
let refreshing: Promise<boolean> | null = null;

export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  if (isDemoSession()) {
    const session = getSession();
    return demoRequest<T>(method, path, options.body, session?.kind === 'senior' ? session.seniorId : undefined);
  }
  const response = await send(method, path, options);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Jeton à présenter (renouvelé si l'accès de l'aidant expire bientôt). */
export async function authorizationHeader(): Promise<string | null> {
  let session = getSession();
  if (session?.kind === 'aidant' && session.accessExpiresAt - Date.now() < REFRESH_MARGIN_MS) {
    await refreshAidant();
    session = getSession();
  }
  if (!session) return null;
  return 'Bearer ' + (session.kind === 'aidant' ? session.accessToken : session.deviceToken);
}

async function send(method: Method, path: string, options: RequestOptions, retried = false): Promise<Response> {
  const base = await getApiBase();
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const authorization = await authorizationHeader();
    if (authorization) headers.Authorization = authorization;
  }

  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch (error) {
    // Un corps impossible à préparer échoue aussi ici : sans cette trace, il passerait pour une panne réseau.
    if (options.form) console.warn("Envoi du fichier impossible", error);
    throw networkError();
  }

  if (response.status === 401 && options.auth !== false && !retried && getSession()?.kind === 'aidant') {
    if (await refreshAidant()) return send(method, path, options, true);
  }
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // corps non JSON
    }
    const error = toApiError(response.status, body);
    if (response.status === 401 && options.auth !== false) {
      await saveSession(null); // jeton révoqué ou appareil désappairé : retour à l'accueil
    }
    throw error;
  }
  return response;
}

/** Rotation du refresh token ; un seul rafraîchissement à la fois. */
async function refreshAidant(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const session = getSession();
      if (session?.kind !== 'aidant') return false;
      try {
        const base = await getApiBase();
        const response = await fetch(base + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (!response.ok) {
          await saveSession(null);
          return false;
        }
        await saveSession(aidantSession((await response.json()) as AuthResponse));
        return true;
      } catch {
        return false; // réseau : on garde la session, la requête échouera normalement
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export function aidantSession(auth: AuthResponse): Session {
  return {
    kind: 'aidant',
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accessExpiresAt: Date.now() + auth.expiresIn * 1000,
    userId: auth.user.id,
    nomComplet: auth.user.nomComplet,
  };
}

export { ApiError };
