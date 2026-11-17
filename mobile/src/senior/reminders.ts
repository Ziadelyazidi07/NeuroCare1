/**
 * Rappels locaux (cahier §4.1 « le rappel part même sans réseau », §9.5, CA-10) : chaque prise à venir
 * des 48 h est programmée comme notification locale, en double du push serveur.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import type { DoseDto } from '../api/types';

export const REMINDER_CHANNEL = 'rappels_medicaments';

/** À appeler au démarrage : affichage des notifications au premier plan et canal Android dédié. */
export async function configureReminders(): Promise<boolean> {
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
}

/** Reprogramme toutes les prises EN_ATTENTE à venir (idempotent : annule puis recrée). */
export async function scheduleReminders(doses: DoseDto[], now: Date = new Date()): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const upcoming = doses.filter((d) => d.statut === 'EN_ATTENTE' && new Date(d.datePrevue) > now);
  for (const dose of upcoming) {
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
  }
  return upcoming.length;
}

/**
 * Token FCM natif enregistré auprès du backend pour les push serveur (cahier §9.3). Indisponible dans
 * Expo Go sur Android (build de développement requis) : l'échec est sans conséquence, les rappels
 * locaux restent actifs.
 */
export async function devicePushToken(): Promise<{ platform: 'ANDROID' | 'IOS'; token: string } | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', token: String(token.data) };
  } catch {
    return null;
  }
}
