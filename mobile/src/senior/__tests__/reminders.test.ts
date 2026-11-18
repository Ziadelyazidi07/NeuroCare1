import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';

import type { DoseDto } from '../../api/types';
import { configureReminders, scheduleReminders } from '../reminders';

const mockIsRunningInExpoGo = jest.fn<() => boolean>();
let mockExecutionEnvironment = 'standalone';
let mockNotificationsLoaded = false;

jest.mock('expo', () => ({
  isRunningInExpoGo: () => mockIsRunningInExpoGo(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get executionEnvironment() {
      return mockExecutionEnvironment;
    },
  },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

jest.mock('expo-notifications', () => {
  mockNotificationsLoaded = true;
  return {
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    cancelAllScheduledNotificationsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn(),
    getDevicePushTokenAsync: jest.fn(),
  };
});

const notifications = jest.mocked(jest.requireMock<typeof NotificationsModule>('expo-notifications'));
const now = new Date('2026-11-18T08:00:00Z');
const doses = [
  { id: 'd1', statut: 'EN_ATTENTE', datePrevue: '2026-11-18T09:00:00Z' },
  { id: 'd2', statut: 'EN_ATTENTE', datePrevue: '2026-11-18T10:00:00Z' },
] as DoseDto[];

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.replaceProperty(Platform, 'OS', 'android');
  mockIsRunningInExpoGo.mockReturnValue(false);
  mockExecutionEnvironment = 'standalone';
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('dans Expo Go', () => {
  const detections: [string, () => void][] = [
    ['module natif ExpoGo présent', () => mockIsRunningInExpoGo.mockReturnValue(true)],
    ['executionEnvironment storeClient', () => void (mockExecutionEnvironment = 'storeClient')],
  ];

  it.each(detections)("ne charge pas expo-notifications et reste silencieux (%s)", async (_name, enterExpoGo) => {
    enterExpoGo();
    mockNotificationsLoaded = false;

    await jest.isolateModulesAsync(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- registre de modules isolé
      const reminders = require('../reminders') as typeof import('../reminders');
      await expect(reminders.configureReminders()).resolves.toBe(false);
      await expect(reminders.scheduleReminders(doses, now)).resolves.toBe(0);
      await expect(reminders.devicePushToken()).resolves.toBeNull();
      expect(() => reminders.onReminderTapped(jest.fn())()).not.toThrow();
    });

    expect(mockNotificationsLoaded).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe('hors Expo Go', () => {
  it('configure le canal Android et accepte la permission accordée', async () => {
    await expect(configureReminders()).resolves.toBe(true);
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
  });

  it('ne rejette pas si la création du canal échoue', async () => {
    notifications.setNotificationChannelAsync.mockRejectedValue(new Error('NullPointerException'));
    await expect(configureReminders()).resolves.toBe(false);
  });

  it("continue la programmation après l'échec d'une prise", async () => {
    notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('échec')).mockResolvedValue('id');
    await expect(scheduleReminders(doses, now)).resolves.toBe(1);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("ne programme rien si l'annulation échoue, pour éviter les doublons", async () => {
    notifications.cancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('échec'));
    await expect(scheduleReminders(doses, now)).resolves.toBe(0);
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
