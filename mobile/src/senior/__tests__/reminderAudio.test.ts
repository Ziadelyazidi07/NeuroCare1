import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createAudioPlayer } from 'expo-audio';

import { seniorApi } from '../../api/api';
import type { DoseDto } from '../../api/types';
import { ApiError } from '../../lib/problem';
import { hasReminderVoice, playReminder, prefetchReminderAudio } from '../reminderAudio';

const mockFiles = new Set<string>();

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), remove: jest.fn() })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    readonly uri: string;
    constructor(_directory: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    static downloadFileAsync = jest.fn(async (_url: string, file: MockFile) => {
      mockFiles.add(file.uri);
      return file;
    });
  }
  return {
    File: MockFile,
    Directory: class {
      create() {}
    },
    Paths: { cache: 'cache' },
  };
});

jest.mock('../../api/api', () => ({ seniorApi: { medicationAudio: jest.fn() } }));

const medicationAudio = jest.mocked(seniorApi.medicationAudio);
const dose = { id: 'd1', medicationId: 'm1', statut: 'EN_ATTENTE', datePrevue: '2026-11-19T09:00:00Z' } as DoseDto;
const signed = (extension: string) => ({ url: 'http://minio/audio', expireLe: '2026-11-19T09:05:00Z', extension });

describe('audio du rappel', () => {
  beforeEach(() => {
    mockFiles.clear();
    medicationAudio.mockReset();
    jest.mocked(createAudioPlayer).mockClear();
  });

  it("joue l'enregistrement de l'aidant dans son format", async () => {
    medicationAudio.mockResolvedValue(signed('m4a'));

    await prefetchReminderAudio([dose]);
    await playReminder(dose);

    expect(hasReminderVoice(dose)).toBe(true);
    expect(createAudioPlayer).toHaveBeenCalledWith('file:///cache/m1.m4a');
  });

  it('remplace le fichier précédent quand le son change de format', async () => {
    mockFiles.add('file:///cache/m1.m4a');
    medicationAudio.mockResolvedValue(signed('mp3'));

    await prefetchReminderAudio([dose]);

    expect([...mockFiles]).toEqual(['file:///cache/m1.mp3']);
  });

  it("efface la voix locale et joue la tonalité quand le serveur n'a plus de voix", async () => {
    mockFiles.add('file:///cache/m1.m4a');
    medicationAudio.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Aucun audio'));

    await prefetchReminderAudio([dose]);
    await playReminder(dose);

    expect(mockFiles.size).toBe(0);
    expect(hasReminderVoice(dose)).toBe(false);
    expect(createAudioPlayer).toHaveBeenCalledWith(expect.not.stringContaining('file:///cache/'));
  });

  it('garde le fichier local sans réseau', async () => {
    mockFiles.add('file:///cache/m1.m4a');
    medicationAudio.mockRejectedValue(new ApiError(0, 'NETWORK', 'Serveur injoignable'));

    await prefetchReminderAudio([dose]);

    expect([...mockFiles]).toEqual(['file:///cache/m1.m4a']);
  });
});
