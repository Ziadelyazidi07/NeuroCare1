/**
 * Rappels locaux (cahier §4.1 « le rappel part même sans réseau », §9.5, CA-10) : chaque prise à venir
 * des 48 h est programmée comme notification locale, en double du push serveur.
 *
 * Les notifications sont désactivées dans Expo Go, où le module natif est incomplet. Ailleurs, un échec
 * est journalisé sans jamais bloquer l'écran du senior ni le chargement de ses prises.
 */
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';

import type { DoseDto } from '../api/types';

export const REMINDER_CHANNEL = 'rappels_medicaments';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** À appeler au démarrage : affichage au premier plan, canal Android dédié et permission. */
export async function configureReminders(): Promise<boolean> {
  if (isExpoGo()) return false;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: 'Rappels médicaments',
        // eslint-disable-next-line import/namespace -- réexporté via « export * » (NotificationChannelManager.types)
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return requested.granted;
  } catch (error) {
    console.warn('Configuration des rappels impossible', error);
    return false;
  }
}

/**
 * Reprogramme toutes les prises EN_ATTENTE à venir (idempotent : annule puis recrée) et renvoie le
 * nombre de rappels réellement programmés. L'échec d'une prise n'empêche pas de programmer les suivantes.
 */
export async function scheduleReminders(doses: DoseDto[], now: Date = new Date()): Promise<number> {
  if (isExpoGo()) return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    // Sans annulation, reprogrammer créerait des rappels en double.
    console.warn('Annulation des rappels impossible', error);
    return 0;
  }
  const upcoming = doses.filter((d) => d.statut === 'EN_ATTENTE' && new Date(d.datePrevue) > now);
  let scheduled = 0;
  for (const dose of upcoming) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "C'est l'heure de ton médicament",
          body: `${dose.nomMedicament ?? 'Médicament'} — appuie sur « C'est fait »`,
          sound: true,
          data: { doseId: dose.id, medicationId: dose.medicationId ?? '' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(dose.datePrevue),
          channelId: REMINDER_CHANNEL,
        },
      });
      scheduled += 1;
    } catch (error) {
      console.warn('Programmation du rappel impossible', error);
    }
  }
  return scheduled;
}

/** Écoute les appuis sur un rappel ; renvoie la fonction de désabonnement. */
export function onReminderTapped(listener: (doseId: unknown) => void): () => void {
  if (isExpoGo()) return () => undefined;
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      listener(response.notification.request.content.data?.doseId);
    });
    return () => subscription.remove();
  } catch (error) {
    console.warn('Écoute des rappels impossible', error);
    return () => undefined;
  }
}

/**
 * Token FCM natif enregistré auprès du backend pour les push serveur (cahier §9.3). Indisponible dans
 * Expo Go (build de développement requis).
 */
export async function devicePushToken(): Promise<{ platform: 'ANDROID' | 'IOS'; token: string } | null> {
  if (isExpoGo()) return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', token: String(token.data) };
  } catch {
    return null;
  }
}
