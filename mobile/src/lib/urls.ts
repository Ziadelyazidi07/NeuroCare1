/** Adresses du backend dérivées de l'URL de l'API REST. */

export const DEFAULT_API_BASE = 'http://localhost:8088/api/v1';

/** Retire la barre finale : « http://h:8088/api/v1/ » → « http://h:8088/api/v1 ». */
export function cleanApiBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** WebSocket STOMP : « http://h:8088/api/v1 » → « ws://h:8088/ws » (https → wss). */
export function wsUrlFromApi(apiBase: string): string {
  const base = cleanApiBase(apiBase).replace(/\/api\/v1$/, '');
  return base.replace(/^http/, 'ws') + '/ws';
}

/** Santé du backend : « http://h:8088/api/v1 » → « http://h:8088/actuator/health ». */
export function healthUrl(apiBase: string): string {
  return cleanApiBase(apiBase).replace(/\/api\/v1$/, '') + '/actuator/health';
}

export function seniorTopic(seniorId: string): string {
  return `/topic/seniors/${seniorId}/events`;
}
