/** Appels de l'API NeuroCare, regroupés par espace. */
import { File } from 'expo-file-system';

import { request } from './client';
import type {
  AuthResponse,
  CognitiveSessionDto,
  CognitiveSessionRequest,
  ConsentDto,
  ConsentHistoryDto,
  ConsentType,
  CreateSeniorRequest,
  DashboardHistory,
  DashboardToday,
  DeviceDto,
  DoseDto,
  ExerciseDto,
  MedicationDto,
  MedicationRequest,
  PairingCodeResponse,
  PairingRedeemResponse,
  ReminderAudioDto,
  SeniorDto,
  SyncResponse,
  UserSummary,
  VoiceProfileDto,
} from './types';
import type { PendingConfirmation } from '../lib/offlineQueue';

export const authApi = {
  register: (nomComplet: string, telephone: string, motDePasse: string) =>
    request<UserSummary>('POST', '/auth/register', { body: { nomComplet, telephone, motDePasse }, auth: false }),
  login: (telephone: string, motDePasse: string) =>
    request<AuthResponse>('POST', '/auth/login', { body: { telephone, motDePasse }, auth: false }),
  logout: (refreshToken: string) => request<void>('POST', '/auth/logout', { body: { refreshToken } }),
  redeemPairingCode: (code: string, plateforme: 'ANDROID' | 'IOS') =>
    request<PairingRedeemResponse>('POST', '/auth/pairing/redeem', { body: { code, plateforme }, auth: false }),
};

/** Espace senior (token d'appareil). */
export const seniorApi = {
  profile: (seniorId: string) => request<SeniorDto>('GET', `/seniors/${seniorId}`),
  upcomingDoses: (hours = 48) => request<DoseDto[]>('GET', `/me/doses/upcoming?hours=${hours}`),
  confirm: (doseId: string, idempotencyKey: string, horodatageClient: string) =>
    request<DoseDto>('POST', `/doses/${doseId}/confirm`, {
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { horodatageClient },
    }),
  sync: (confirmations: PendingConfirmation[]) =>
    request<SyncResponse>('POST', '/me/doses/sync', { body: { confirmations } }),
  medicationAudio: (medicationId: string) => request<ReminderAudioDto>('GET', `/me/medications/${medicationId}/audio`),
  registerDevice: (plateforme: 'ANDROID' | 'IOS', fcmToken: string) =>
    request<void>('POST', '/me/devices', { body: { plateforme, fcmToken } }),
  nextExercise: (nombre = 3) => request<ExerciseDto>('GET', `/me/cognitive/next?type=RAPPEL_MOTS&nombre=${nombre}`),
  recordExercise: (session: CognitiveSessionRequest) =>
    request<CognitiveSessionDto>('POST', '/me/cognitive/sessions', { body: session }),
};

/** Espace aidant (JWT). */
export const aidantApi = {
  seniors: () => request<SeniorDto[]>('GET', '/seniors'),
  createSenior: (body: CreateSeniorRequest) => request<SeniorDto>('POST', '/seniors', { body }),
  senior: (seniorId: string) => request<SeniorDto>('GET', `/seniors/${seniorId}`),
  pairingCode: (seniorId: string) => request<PairingCodeResponse>('POST', `/seniors/${seniorId}/pairing-codes`),
  devices: (seniorId: string) => request<DeviceDto[]>('GET', `/seniors/${seniorId}/devices`),
  revokeDevice: (seniorId: string, deviceId: string) => request<void>('DELETE', `/seniors/${seniorId}/devices/${deviceId}`),

  dashboardToday: (seniorId: string) => request<DashboardToday>('GET', `/seniors/${seniorId}/dashboard/today`),
  dashboardHistory: (seniorId: string, days = 7) =>
    request<DashboardHistory>('GET', `/seniors/${seniorId}/dashboard/history?days=${days}`),

  medications: (seniorId: string) => request<MedicationDto[]>('GET', `/seniors/${seniorId}/medications`),
  createMedication: (seniorId: string, body: MedicationRequest) =>
    request<MedicationDto>('POST', `/seniors/${seniorId}/medications`, { body }),
  deactivateMedication: (medicationId: string) =>
    request<MedicationDto>('PATCH', `/medications/${medicationId}/deactivate`),

  consents: (seniorId: string) => request<ConsentDto[]>('GET', `/seniors/${seniorId}/consents`),
  consentHistory: (seniorId: string) => request<ConsentHistoryDto[]>('GET', `/seniors/${seniorId}/consents/history`),
  setConsent: (seniorId: string, type: ConsentType, accorde: boolean) =>
    request<ConsentDto>('PUT', `/seniors/${seniorId}/consents/${type}`, {
      // L'aidant enregistre le choix exprimé par le senior, en sa présence (cahier §7.2).
      body: { accorde, versionTexte: CONSENT_TEXT_VERSION, presenceSeniorConfirmee: true },
    }),

  voiceProfile: (seniorId: string) => request<VoiceProfileDto>('GET', `/seniors/${seniorId}/voice-profile`),
  uploadVoice: async (seniorId: string, fileUri: string) => {
    const file = new File(fileUri);
    if (!file.exists) throw new Error("L'enregistrement est introuvable. Recommencez-le.");
    const form = new FormData();
    // Le fetch d'Expo lit les octets d'un File ; il refuse la forme React Native { uri, name, type }.
    form.append('file', file);
    return request<VoiceProfileDto>('POST', `/seniors/${seniorId}/voice-profile`, { form });
  },
  deleteVoice: (seniorId: string) => request<void>('DELETE', `/seniors/${seniorId}/voice-profile`),
};

/** Version de la notice d'information présentée au senior pour les consentements. */
export const CONSENT_TEXT_VERSION = 'v1';

/** Chemin du rapport PDF (téléchargé directement dans un fichier, voir report.tsx). */
export function weeklyReportPath(seniorId: string, weekStart: string, observations: string): string {
  const query = `weekStart=${weekStart}` + (observations.trim() ? `&observations=${encodeURIComponent(observations.trim())}` : '');
  return `/seniors/${seniorId}/reports/weekly?${query}`;
}
