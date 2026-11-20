/** Session partagée par les écrans : aidant (JWT) ou senior (téléphone appairé). */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { authApi } from '../api/api';
import { aidantSession } from '../api/client';
import { DEMO_AIDANT, DEMO_SENIOR_ID } from '../demo/demoData';
import { prepareDemo } from '../demo/demoBackend';
import { clearSeniorData, flushQueue } from '../senior/offlineStore';
import { clearReminderAudio } from '../senior/reminderAudio';
import { cancelReminders } from '../senior/reminders';
import { loadSession, onSessionChange, saveSession, getSession, type Session } from './sessionStore';

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  signInAidant: (telephone: string, motDePasse: string) => Promise<void>;
  pairSenior: (code: string) => Promise<void>;
  /** Mode démo hors ligne : entre dans l'espace aidant ou senior avec des données locales, sans serveur. */
  enterDemo: (kind: 'aidant' | 'senior') => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSessionChange(setSession);
    loadSession()
      .then(setSession)
      .finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      signInAidant: async (telephone, motDePasse) => {
        await saveSession(aidantSession(await authApi.login(telephone, motDePasse)));
      },
      pairSenior: async (code) => {
        const paired = await authApi.redeemPairingCode(code, Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
        await saveSession({ kind: 'senior', deviceToken: paired.deviceToken, seniorId: paired.seniorId, nomComplet: paired.nomComplet });
      },
      enterDemo: async (kind) => {
        await prepareDemo();
        await saveSession(
          kind === 'aidant'
            ? {
                kind: 'aidant',
                demo: true,
                accessToken: 'demo',
                refreshToken: 'demo',
                accessExpiresAt: Date.now() + 365 * 86_400_000,
                userId: DEMO_AIDANT.id,
                nomComplet: DEMO_AIDANT.nomComplet,
              }
            : { kind: 'senior', demo: true, deviceToken: 'demo', seniorId: DEMO_SENIOR_ID, nomComplet: 'Hajja Zahra' },
        );
      },
      signOut: async () => {
        const current = getSession();
        if (current?.kind === 'aidant') {
          try {
            await authApi.logout(current.refreshToken);
          } catch {
            // hors ligne : la session locale est quand même effacée
          }
        } else if (current?.kind === 'senior') {
          clearReminderAudio();
          try {
            await flushQueue(); // dernières confirmations « C'est fait » faites hors ligne
          } catch {
            // hors ligne : elles seront perdues avec la session
          }
          await cancelReminders();
          await clearSeniorData();
        }
        await saveSession(null);
      },
    }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession doit être utilisé dans SessionProvider');
  return value;
}
