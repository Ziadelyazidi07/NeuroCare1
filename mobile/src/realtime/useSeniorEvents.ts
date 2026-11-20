/**
 * Temps réel de l'aidant et du senior (cahier §9.4) : abonnement STOMP à /topic/seniors/{seniorId}/events.
 * Le jeton est présenté à la trame CONNECT (le serveur le vérifie avant d'accepter l'abonnement).
 */
import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';

import { authorizationHeader } from '../api/client';
import { isDemoSession } from '../auth/sessionStore';
import { onDemoEvent } from '../demo/demoEvents';
import { getApiBase } from '../api/config';
import type { RealtimeEvent } from '../api/types';
import { seniorTopic, wsUrlFromApi } from '../lib/urls';

export type RealtimeStatus = 'connexion' | 'connecte' | 'deconnecte';

export function useSeniorEvents(seniorId: string | undefined, onEvent: (event: RealtimeEvent) => void): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connexion');
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!seniorId) return;
    if (isDemoSession()) {
      // Démo hors ligne : événements du serveur local, sans WebSocket.
      const unsubscribe = onDemoEvent((event) => {
        if ('seniorId' in event && event.seniorId === seniorId) handler.current(event);
      });
      const timer = setTimeout(() => setStatus('connecte'), 0);
      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }
    let client: Client | null = null;
    let cancelled = false;

    (async () => {
      const url = wsUrlFromApi(await getApiBase());
      if (cancelled) return;
      client = new Client({
        webSocketFactory: () => new WebSocket(url),
        // Jeton relu à chaque (re)connexion : le JWT de l'aidant est renouvelé toutes les 15 min.
        beforeConnect: async (c) => {
          const authorization = await authorizationHeader();
          c.connectHeaders = authorization ? { Authorization: authorization } : {};
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        // Contournements nécessaires avec le WebSocket de React Native.
        forceBinaryWSFrames: true,
        appendMissingNULLonIncoming: true,
        onConnect: () => {
          setStatus('connecte');
          client?.subscribe(seniorTopic(seniorId), (message) => {
            try {
              handler.current(JSON.parse(message.body) as RealtimeEvent);
            } catch {
              // message illisible ignoré
            }
          });
        },
        onStompError: () => setStatus('deconnecte'),
        onWebSocketClose: () => setStatus('deconnecte'),
      });
      client.activate();
    })();

    return () => {
      cancelled = true;
      void client?.deactivate();
    };
  }, [seniorId]);

  return status;
}
