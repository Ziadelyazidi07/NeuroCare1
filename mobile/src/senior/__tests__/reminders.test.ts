import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import type { DoseDto } from '../../api/types';
import { configureReminders, devicePushToken, onReminderTapped, scheduleReminders } from '../reminders';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'standalone' },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

jest.mock('expo-notifications', () => ({
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
}));

const notifications = jest.mocked(Notifications);
const constants = Constants as unknown as { executionEnvironment: string };
const now = new Date('2026-11-18T08:00:00Z');
const doses = [
  { id: 'd1', statut: 'EN_ATTENTE', datePrevue: '2026-11-18T09:00:00Z' },
  { id: 'd2', statut: 'EN_ATTENTE', datePrevue: '2026-11-18T10:00:00Z' },
] as DoseDto[];

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.replaceProperty(Platform, 'OS', 'android');
  constants.executionEnvironment = 'standalone';
  notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('dans Expo Go', () => {
  beforeEach(() => {
    constants.executionEnvironment = 'storeClient';
  });

  it("n'appelle aucune fonction native de notification", async () => {
    await expect(configureReminders()).resolves.toBe(false);
    await expect(scheduleReminders(doses, now)).resolves.toBe(0);
    await expect(devicePushToken()).resolves.toBeNull();
    expect(() => onReminderTapped(jest.fn())()).not.toThrow();

    expect(notifications.setNotificationHandler).not.toHaveBeenCalled();
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
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
