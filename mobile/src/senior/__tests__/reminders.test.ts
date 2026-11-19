import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Linking, Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';

import type { DoseDto } from '../../api/types';
import {
  ALARM_CHANNEL,
  PRE_REMINDER_CHANNEL,
  configureReminders,
  consumeLaunchReminder,
  enableAlerts,
  getAlertPermissions,
  hasLaunchReminder,
  onReminderOpened,
  onReminderTapped,
  scheduleReminders,
} from '../reminders';

const mockIsRunningInExpoGo = jest.fn<() => boolean>();
let mockNotificationsLoaded = false;

jest.mock('expo', () => ({
  isRunningInExpoGo: () => mockIsRunningInExpoGo(),
}));

jest.mock('expo-notifications', () => {
  mockNotificationsLoaded = true;
  return {
    AndroidImportance: { HIGH: 6, MAX: 7 },
    AndroidAudioUsage: { ALARM: 4 },
    AndroidAudioContentType: { SONIFICATION: 4 },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    AndroidNotificationPriority: { MAX: 'max' },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    deleteNotificationChannelAsync: jest.fn(),
    setNotificationCategoryAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getExactAlarmPermissionsAsync: jest.fn(),
    requestExactAlarmPermissionsAsync: jest.fn(),
    cancelAllScheduledNotificationsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(),
    addNotificationReceivedListener: jest.fn(),
    getLastNotificationResponse: jest.fn(),
    clearLastNotificationResponse: jest.fn(),
    getDevicePushTokenAsync: jest.fn(),
  };
});

const notifications = jest.mocked(jest.requireMock<typeof NotificationsModule>('expo-notifications'));
const now = new Date('2026-11-18T08:00:00Z');
const doses = [
  { id: 'd1', medicationId: 'm1', nomMedicament: 'Metformine', statut: 'EN_ATTENTE', datePrevue: '2026-11-18T09:00:00Z' },
] as DoseDto[];
const granted = (value: boolean, canAskAgain = true) => ({ granted: value, canAskAgain }) as never;
const response = (data: Record<string, unknown>) => ({ notification: { request: { content: { data } } } }) as never;

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.replaceProperty(Platform, 'OS', 'android');
  mockIsRunningInExpoGo.mockReturnValue(false);
  notifications.getPermissionsAsync.mockResolvedValue(granted(true));
  notifications.getExactAlarmPermissionsAsync.mockResolvedValue(granted(true));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('dans Expo Go', () => {
  it('ne charge pas expo-notifications et reste silencieux', async () => {
    mockIsRunningInExpoGo.mockReturnValue(true);
    mockNotificationsLoaded = false;

    await jest.isolateModulesAsync(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- registre de modules isolé
      const reminders = require('../reminders') as typeof import('../reminders');
      await expect(reminders.configureReminders()).resolves.toBe(false);
      await expect(reminders.scheduleReminders(doses, now)).resolves.toBe(0);
      await expect(reminders.getAlertPermissions()).resolves.toBeNull();
      await expect(reminders.enableAlerts()).resolves.toBeNull();
      await expect(reminders.devicePushToken()).resolves.toBeNull();
      expect(() => reminders.onReminderTapped(jest.fn())()).not.toThrow();
      expect(() => reminders.onReminderReceived(jest.fn())()).not.toThrow();
      expect(reminders.consumeLaunchReminder()).toBeUndefined();
      expect(reminders.hasLaunchReminder()).toBe(false);
      expect(() => reminders.onReminderOpened(jest.fn())()).not.toThrow();
    });

    expect(mockNotificationsLoaded).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe('dans un build natif', () => {
  it("crée un canal d'alarme avec son, vibration et écran verrouillé", async () => {
    await expect(configureReminders()).resolves.toBe(true);

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      ALARM_CHANNEL,
      expect.objectContaining({
        importance: 7,
        sound: 'alarme_rappel.wav',
        audioAttributes: { usage: 4, contentType: 4 },
        enableVibrate: true,
        lockscreenVisibility: 1,
      }),
    );
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(PRE_REMINDER_CHANNEL, expect.anything());
  });

  it('ne rejette pas si la création du canal échoue', async () => {
    notifications.setNotificationChannelAsync.mockRejectedValue(new Error('NullPointerException'));
    await expect(configureReminders()).resolves.toBe(false);
  });

  it('programme le rappel à T-10 min puis alarme à l’heure exacte', async () => {
    await expect(scheduleReminders(doses, now)).resolves.toBe(2);

    const [early, alarm] = notifications.scheduleNotificationAsync.mock.calls.map(([request]) => request);
    expect(early?.content).toMatchObject({
      title: 'Rappel bientôt',
      body: "L'heure de votre médicament (Metformine) approche dans 10 minutes",
    });
    expect(early?.trigger).toMatchObject({ date: new Date('2026-11-18T08:50:00Z'), channelId: PRE_REMINDER_CHANNEL });
    expect(alarm?.content).toMatchObject({ priority: 'max', categoryIdentifier: 'alarme_medicament', sound: 'alarme_rappel.wav' });
    expect(alarm?.trigger).toMatchObject({ date: new Date('2026-11-18T09:00:00Z'), channelId: ALARM_CHANNEL });
  });

  it('ne programme que l’alarme quand il reste moins de 10 minutes', async () => {
    await expect(scheduleReminders(doses, new Date('2026-11-18T08:55:00Z'))).resolves.toBe(1);
    expect(notifications.scheduleNotificationAsync.mock.calls[0]?.[0].trigger).toMatchObject({ channelId: ALARM_CHANNEL });
  });

  it("continue la programmation après l'échec d'une notification", async () => {
    notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('échec')).mockResolvedValue('id');
    await expect(scheduleReminders(doses, now)).resolves.toBe(1);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("ne programme rien si l'annulation échoue, pour éviter les doublons", async () => {
    notifications.cancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('échec'));
    await expect(scheduleReminders(doses, now)).resolves.toBe(0);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("ne lance la voix qu'à l'ouverture depuis l'alarme", () => {
    notifications.getLastNotificationResponse.mockReturnValueOnce(response({ doseId: 'd1', kind: 'alarme' }));
    expect(consumeLaunchReminder()).toBe('d1');
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);

    notifications.getLastNotificationResponse.mockReturnValueOnce(response({ doseId: 'd1', kind: 'avant' }));
    expect(consumeLaunchReminder()).toBeUndefined();
  });

  it("repère sans la consommer l'alarme qui a ouvert l'application", () => {
    notifications.getLastNotificationResponse.mockReturnValue(response({ doseId: 'd1', kind: 'alarme' }));
    expect(hasLaunchReminder()).toBe(true);
    expect(notifications.clearLastNotificationResponse).not.toHaveBeenCalled();

    notifications.getLastNotificationResponse.mockReturnValue(response({ doseId: 'd1', kind: 'avant' }));
    expect(hasLaunchReminder()).toBe(false);
  });

  it("signale l'appui sur une alarme sans effacer la notification", () => {
    const listener = jest.fn();
    notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() } as never);
    onReminderOpened(listener);
    const handler = notifications.addNotificationResponseReceivedListener.mock.calls[0]?.[0];

    handler?.(response({ doseId: 'd1', kind: 'avant' }));
    expect(listener).not.toHaveBeenCalled();
    handler?.(response({ doseId: 'd1', kind: 'alarme' }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
  });

  it('ignore un appui sur le rappel préventif', () => {
    const listener = jest.fn();
    notifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() } as never);
    onReminderTapped(listener);
    const handler = notifications.addNotificationResponseReceivedListener.mock.calls[0]?.[0];

    handler?.(response({ doseId: 'd1', kind: 'avant' }));
    expect(listener).not.toHaveBeenCalled();
    handler?.(response({ doseId: 'd1', kind: 'alarme' }));
    expect(listener).toHaveBeenCalledWith('d1');
  });
});

describe('autorisations', () => {
  it('signale une autorisation manquante', async () => {
    notifications.getExactAlarmPermissionsAsync.mockResolvedValue(granted(false));
    await expect(getAlertPermissions()).resolves.toEqual({ notifications: true, exactAlarms: false });
  });

  it('redemande les notifications quand Android le permet', async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce(granted(false));
    notifications.requestPermissionsAsync.mockResolvedValue(granted(true));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await enableAlerts();

    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('ouvre les réglages après un refus définitif', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(granted(false, false));
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await enableAlerts();

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('demande les alarmes exactes si elles manquent', async () => {
    notifications.getExactAlarmPermissionsAsync.mockResolvedValue(granted(false));
    await enableAlerts();
    expect(notifications.requestExactAlarmPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
