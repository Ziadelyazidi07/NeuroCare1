/**
 * Rappels locaux (cahier §4.1 « le rappel part même sans réseau », §9.5, CA-10) : pour chaque prise à
 * venir des 48 h, un rappel préventif à T-10 min et une alarme à l'heure exacte, délivrés par Android
 * même application fermée ou écran verrouillé, en double du push serveur.
 *
 * Dans Expo Go, expo-notifications n'est même pas chargé : son module natif y est incomplet et son
 * import émet des avertissements. Dans un build natif, un échec est journalisé sans jamais bloquer
 * l'écran du senior ni le chargement de ses prises.
 */
import { Linking, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import type { DoseDto } from '../api/types';

type NotificationsModule = typeof import('expo-notifications');
type NotificationContent = { data?: Record<string, unknown> | null };

/** Les réglages d'un canal Android sont figés à sa création : changer un réglage impose un nouvel identifiant. */
export const ALARM_CHANNEL = 'alarme_medicament_v1';
export const PRE_REMINDER_CHANNEL = 'rappel_preventif_v1';
const LEGACY_CHANNEL = 'rappels_medicaments';

const ALARM_CATEGORY = 'alarme_medicament';
const ALARM_SOUND = 'alarme_rappel.wav';
const ALARM_VIBRATION = [0, 800, 300, 800, 300, 800, 300, 1200];
const PRE_REMINDER_MS = 10 * 60 * 1000;
const PRE_REMINDER_KIND = 'avant';
const ALARM_KIND = 'alarme';
const IOS_PERMISSIONS = { ios: { allowAlert: true, allowSound: true, allowBadge: false } };

/** État des autorisations ; null dans Expo Go, où les alertes natives n'existent pas. */
export interface AlertPermissions {
  notifications: boolean;
  exactAlarms: boolean;
}

function loadNotifications(): NotificationsModule | null {
  if (isRunningInExpoGo()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement conditionnel, sans effet de bord dans Expo Go
  return require('expo-notifications') as NotificationsModule;
}

/** Prise à annoncer par la voix : le rappel préventif, lui, ne la déclenche pas. */
function alarmDoseId(content: NotificationContent): unknown {
  return content.data?.kind === PRE_REMINDER_KIND ? undefined : content.data?.doseId;
}

async function configureAndroid(Notifications: NotificationsModule): Promise<void> {
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
    name: 'Alarme médicament',
    importance: Notifications.AndroidImportance.MAX,
    sound: ALARM_SOUND,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    enableVibrate: true,
    vibrationPattern: ALARM_VIBRATION,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
  await Notifications.setNotificationChannelAsync(PRE_REMINDER_CHANNEL, {
    name: 'Rappel avant le médicament',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.deleteNotificationChannelAsync(LEGACY_CHANNEL);
}

/**
 * À appeler au démarrage : canaux Android, bouton de l'alarme et demande d'autorisation. Application
 * ouverte, l'alarme reste muette : c'est la voix de l'aidant qui se fait entendre.
 */
export async function configureReminders(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: notification.request.content.data?.kind === PRE_REMINDER_KIND,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') await configureAndroid(Notifications);
    await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY, [
      { identifier: 'ecouter', buttonTitle: 'Écouter le message', options: { opensAppToForeground: true } },
    ]);
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync(IOS_PERMISSIONS)).granted;
  } catch (error) {
    console.warn('Configuration des rappels impossible', error);
    return false;
  }
}

export async function getAlertPermissions(): Promise<AlertPermissions | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const notifications = await Notifications.getPermissionsAsync();
    const exactAlarms = Platform.OS === 'android' ? (await Notifications.getExactAlarmPermissionsAsync()).granted : true;
    return { notifications: notifications.granted, exactAlarms };
  } catch (error) {
    console.warn('Lecture des autorisations impossible', error);
    return null;
  }
}

/** Demande ce qui manque ; si Android ne peut plus demander, ouvre les réglages de l'application. */
export async function enableAlerts(): Promise<AlertPermissions | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    let notifications = await Notifications.getPermissionsAsync();
    if (!notifications.granted) {
      if (!notifications.canAskAgain) {
        await Linking.openSettings();
        return await getAlertPermissions();
      }
      notifications = await Notifications.requestPermissionsAsync(IOS_PERMISSIONS);
    }
    if (notifications.granted && Platform.OS === 'android') {
      const exactAlarms = await Notifications.getExactAlarmPermissionsAsync();
      if (!exactAlarms.granted) await Notifications.requestExactAlarmPermissionsAsync();
    }
  } catch (error) {
    console.warn('Activation des alertes impossible', error);
  }
  return getAlertPermissions();
}

async function scheduleSafely(
  Notifications: NotificationsModule,
  request: Parameters<NotificationsModule['scheduleNotificationAsync']>[0],
): Promise<number> {
  try {
    await Notifications.scheduleNotificationAsync(request);
    return 1;
  } catch (error) {
    console.warn('Programmation du rappel impossible', error);
    return 0;
  }
}

/**
 * Reprogramme les prises EN_ATTENTE à venir (idempotent : annule puis recrée) et renvoie le nombre de
 * notifications réellement programmées. Un échec n'empêche pas de programmer les suivantes.
 */
export async function scheduleReminders(doses: DoseDto[], now: Date = new Date()): Promise<number> {
  const Notifications = loadNotifications();
  if (!Notifications) return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    // Sans annulation, reprogrammer créerait des rappels en double.
    console.warn('Annulation des rappels impossible', error);
    return 0;
  }
  let scheduled = 0;
  for (const dose of doses.filter((d) => d.statut === 'EN_ATTENTE')) {
    const name = dose.nomMedicament ?? 'Médicament';
    const data = { doseId: dose.id, medicationId: dose.medicationId ?? '' };
    const alarmAt = new Date(dose.datePrevue);
    const preReminderAt = new Date(alarmAt.getTime() - PRE_REMINDER_MS);

    if (preReminderAt > now) {
      scheduled += await scheduleSafely(Notifications, {
        content: {
          title: 'Rappel bientôt',
          body: `L'heure de votre médicament (${name}) approche dans 10 minutes`,
          sound: true,
          data: { ...data, kind: PRE_REMINDER_KIND },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: preReminderAt,
          channelId: PRE_REMINDER_CHANNEL,
        },
      });
    }
    if (alarmAt > now) {
      scheduled += await scheduleSafely(Notifications, {
        content: {
          title: "C'est l'heure de ton médicament",
          body: `${name} — appuie sur « C'est fait »`,
          sound: ALARM_SOUND,
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: ALARM_VIBRATION,
          categoryIdentifier: ALARM_CATEGORY,
          data: { ...data, kind: ALARM_KIND },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: alarmAt,
          channelId: ALARM_CHANNEL,
        },
      });
    }
  }
  return scheduled;
}

/** Annule toutes les notifications programmées (déconnexion du téléphone senior). */
export async function cancelReminders(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('Annulation des rappels impossible', error);
  }
}

/** Écoute les appuis sur une alarme ; renvoie la fonction de désabonnement. */
export function onReminderTapped(listener: (doseId: unknown) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      Notifications.clearLastNotificationResponse();
      const doseId = alarmDoseId(response.notification.request.content);
      if (doseId) listener(doseId);
    });
    return () => subscription.remove();
  } catch (error) {
    console.warn('Écoute des rappels impossible', error);
    return () => undefined;
  }
}

/** Écoute les alarmes reçues pendant que l'application est ouverte. */
export function onReminderReceived(listener: (doseId: unknown) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => undefined;
  try {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const doseId = alarmDoseId(notification.request.content);
      if (doseId) listener(doseId);
    });
    return () => subscription.remove();
  } catch (error) {
    console.warn('Écoute des rappels impossible', error);
    return () => undefined;
  }
}

/** Prise de l'alarme qui a ouvert l'application, prise en compte une seule fois. */
export function consumeLaunchReminder(): unknown {
  const Notifications = loadNotifications();
  if (!Notifications) return undefined;
  try {
    const response = Notifications.getLastNotificationResponse();
    if (!response) return undefined;
    Notifications.clearLastNotificationResponse();
    return alarmDoseId(response.notification.request.content);
  } catch (error) {
    console.warn('Lecture de la notification impossible', error);
    return undefined;
  }
}

/**
 * Token FCM natif enregistré auprès du backend pour les push serveur (cahier §9.3). Indisponible dans
 * Expo Go (build de développement requis).
 */
export async function devicePushToken(): Promise<{ platform: 'ANDROID' | 'IOS'; token: string } | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', token: String(token.data) };
  } catch {
    return null;
  }
}
