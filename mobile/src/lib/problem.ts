/** Erreurs de l'API au format RFC 7807 (ProblemDetail + code métier NeuroCare). */

import type { Dictionary } from '../i18n';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isConsentRequired(): boolean {
    return this.code === 'CONSENT_REQUIRED';
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

interface ProblemBody {
  code?: string;
  detail?: string;
  title?: string;
  errors?: { field: string; message: string }[];
}

export function toApiError(status: number, body: unknown): ApiError {
  const problem = (typeof body === 'object' && body !== null ? body : {}) as ProblemBody;
  const fields = Array.isArray(problem.errors) ? problem.errors : [];
  const detail =
    fields.length > 0
      ? fields.map((e) => `${e.field} : ${e.message}`).join('\n')
      : problem.detail ?? problem.title ?? `Erreur ${status}`;
  return new ApiError(status, problem.code ?? `HTTP_${status}`, detail, fields);
}

export function networkError(): ApiError {
  return new ApiError(0, 'NETWORK', 'Serveur injoignable. Vérifiez la connexion.');
}

/**
 * Message lisible pour l'utilisateur, dans la langue choisie pour les erreurs connues (réseau, statut HTTP
 * sans détail). Le détail renvoyé par le serveur est affiché tel quel.
 */
export function errorMessage(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK') return t.errors.network;
    if (error.message === `Erreur ${error.status}`) return t.errors.http(error.status);
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return t.errors.unexpected;
}
