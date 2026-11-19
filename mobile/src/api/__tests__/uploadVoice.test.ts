import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';

import { aidantApi } from '../api';
import { request } from '../client';

const mockFileState = { exists: true };

jest.mock('../client', () => ({ request: jest.fn() }));

jest.mock('expo-file-system', () => ({
  File: class {
    readonly name = 'recording.m4a';
    readonly type = 'audio/mp4';
    readonly exists = mockFileState.exists;
    async bytes() {
      return new Uint8Array([1, 2, 3, 4]);
    }
  },
}));

const mockedRequest = jest.mocked(request);

// Même FormData que sur le téléphone : celui de React Native, corrigé par Expo (pas celui de Node).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- module interne sans types
const ReactNativeFormData = require('react-native/Libraries/Network/FormData').default as typeof FormData;
const { installFormDataPatch } = jest.requireActual<typeof import('expo/src/winter/FormData')>(
  'expo/src/winter/FormData',
);

describe('uploadVoice', () => {
  beforeEach(() => {
    installFormDataPatch(ReactNativeFormData);
    globalThis.FormData = ReactNativeFormData;
    mockFileState.exists = true;
    mockedRequest.mockReset();
    mockedRequest.mockResolvedValue({ id: 'v1', statut: 'EN_COURS', dateCreation: '2026-11-19T10:00:00Z' });
  });

  it('produit un corps multipart que le fetch Expo sait encoder', async () => {
    await aidantApi.uploadVoice('s1', 'file:///cache/recording.m4a');

    expect(mockedRequest.mock.calls[0]?.slice(0, 2)).toEqual(['POST', '/seniors/s1/voice-profile']);
    const options = mockedRequest.mock.calls[0]?.[2] as { form: FormData };
    const { body, boundary } = await convertFormDataAsync(options.form, 'limite');
    const text = String.fromCharCode(...body);

    expect(boundary).toBe('limite');
    expect(text).toContain('content-disposition: form-data; name="file"; filename="recording.m4a"');
    expect(text).toContain('content-type: audio/mp4');
    expect(text).toContain('\r\n\r\n\u0001\u0002\u0003\u0004\r\n--limite--');
  });

  it("signale un enregistrement disparu sans appeler le serveur", async () => {
    mockFileState.exists = false;

    await expect(aidantApi.uploadVoice('s1', 'file:///cache/absent.m4a')).rejects.toThrow('introuvable');
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});
