import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';

import { aidantApi, seniorApi } from '../../api/api';
import type { DashboardToday, DoseDto, RealtimeEvent } from '../../api/types';
import { saveSession } from '../../auth/sessionStore';
import { fr } from '../../i18n/fr';
import { ApiError } from '../../lib/problem';
import { healthUrl } from '../../lib/urls';
import { clearDemo, demoRequest, prepareDemo } from '../demoBackend';
import { DEMO_SENIOR_ID, dosesBetween, seedState } from '../demoData';
import { onDemoEvent } from '../demoEvents';
import { demoReportHtml } from '../demoReport';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock officiel du paquet
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'file:///rapport.pdf' })) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', deleteAsync: jest.fn(), moveAsync: jest.fn() }));

const NOW = new Date(2026, 10, 20, 10, 0);
const senior = (path: string, method = 'GET', body?: unknown) => demoRequest<unknown>(method, path, body, DEMO_SENIOR_ID, NOW);
const aidant = <T>(path: string, method = 'GET', body?: unknown) => demoRequest<T>(method, path, body, undefined, NOW);

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearDemo();
  await prepareDemo(true, NOW);
});

describe('données de démonstration', () => {
  it('crée une senior fictive avec 3 traitements actifs et 7 jours d’historique', async () => {
    const [zahra] = await aidant<{ nomComplet: string; donneesFictives: boolean }[]>('/seniors');
    expect(zahra).toMatchObject({ nomComplet: 'Hajja Zahra', donneesFictives: true });
    expect(await aidant<unknown[]>(`/seniors/${DEMO_SENIOR_ID}/medications`)).toHaveLength(3);
    const history = await aidant<{ jours: { confirmees: number; sansReponse: number; tauxConfirmation?: number }[] }>(
      `/seniors/${DEMO_SENIOR_ID}/dashboard/history?days=7`,
    );
    expect(history.jours).toHaveLength(7);
    const past = history.jours.slice(0, 6);
    expect(past.every((j) => j.confirmees + j.sansReponse === 4)).toBe(true);
    expect(past.some((j) => (j.tauxConfirmation ?? 0) < 100)).toBe(true);
  });

  it('recalcule toujours le même historique simulé (affichage stable)', () => {
    const state = seedState(NOW);
    const from = new Date(2026, 10, 14);
    expect(dosesBetween(state, DEMO_SENIOR_ID, from, NOW, NOW)).toEqual(dosesBetween(state, DEMO_SENIOR_ID, from, NOW, NOW));
  });
});

describe('« C’est fait » et tableau de bord', () => {
  it('propose une prise à confirmer tout de suite, la confirme et la diffuse en temps réel', async () => {
    const doses = (await senior('/me/doses/upcoming?hours=48')) as DoseDto[];
    const live = doses.find((d) => d.nomMedicament === 'Vitamine D3' && d.statut === 'EN_ATTENTE' && d.datePrevue.startsWith('2026-11-20'));
    if (!live) throw new Error('prise de démonstration attendue');
    expect(new Date(live.datePrevue).getTime() - NOW.getTime()).toBe(2 * 60_000);

    const events: RealtimeEvent[] = [];
    const stop = onDemoEvent((e) => events.push(e));
    const confirmed = (await senior(`/doses/${live.id}/confirm`, 'POST', { horodatageClient: NOW.toISOString() })) as DoseDto;
    stop();
    expect(confirmed.statut).toBe('CONFIRME');
    expect(events[0]).toMatchObject({ type: 'DOSE_STATUS_CHANGED', doseId: live.id, statut: 'CONFIRME', couleur: 'VERT' });

    const today = await aidant<DashboardToday>(`/seniors/${DEMO_SENIOR_ID}/dashboard/today`);
    expect(today.prises.find((p) => p.doseId === live.id)?.couleur).toBe('VERT');
    expect(today.resume.total).toBe(4);
  });

  it('refuse une prise de demain (fenêtre de 30 min) et accepte la file hors ligne', async () => {
    const doses = (await senior('/me/doses/upcoming?hours=48')) as DoseDto[];
    const tomorrow = doses.find((d) => d.datePrevue.startsWith('2026-11-21'));
    await expect(senior(`/doses/${tomorrow?.id}/confirm`, 'POST', {})).rejects.toMatchObject({ status: 409 });
    const live = doses.find((d) => d.nomMedicament === 'Vitamine D3' && d.statut === 'EN_ATTENTE');
    const sync = (await senior('/me/doses/sync', 'POST', {
      confirmations: [{ doseId: live?.id, clientRequestId: 'k1', horodatageClient: NOW.toISOString() }],
    })) as { resultats: { resultat: string }[] };
    expect(sync.resultats[0]?.resultat).toBe('APPLIQUEE');
  });
});

describe('règles reprises du serveur', () => {
  it('exige le partage familial pour le tableau de bord d’un nouveau senior', async () => {
    const created = await aidant<{ id: string }>('/seniors', 'POST', { nomComplet: 'Si Mohammed', langue: 'DARIJA' });
    await expect(aidant(`/seniors/${created.id}/dashboard/today`)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await aidant(`/seniors/${created.id}/consents/PARTAGE_FAMILIAL`, 'PUT', { accorde: true, versionTexte: 'v1' });
    await expect(aidant(`/seniors/${created.id}/dashboard/today`)).resolves.toBeTruthy();
  });

  it('ajoute un traitement, prévient le téléphone du senior et l’inclut dans les prises', async () => {
    const events: RealtimeEvent[] = [];
    const stop = onDemoEvent((e) => events.push(e));
    await aidant(`/seniors/${DEMO_SENIOR_ID}/medications`, 'POST', {
      nomMedicament: 'Atorvastatine 20 mg',
      dateDebut: '2026-11-20',
      horaires: [{ heure: '21:00', jours: ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] }],
    });
    stop();
    expect(events).toContainEqual({ type: 'REMINDERS_UPDATED', seniorId: DEMO_SENIOR_ID });
    const doses = (await senior('/me/doses/upcoming?hours=48')) as DoseDto[];
    expect(doses.some((d) => d.nomMedicament === 'Atorvastatine 20 mg')).toBe(true);
  });

  it('répond 404 aux routes inconnues et à la voix clonée (tonalité de rappel)', async () => {
    await expect(senior('/me/medications/demo-med-vitd/audio')).rejects.toBeInstanceOf(ApiError);
    await expect(aidant('/inconnu')).rejects.toMatchObject({ status: 404 });
  });
});

describe('client HTTP en session de démo', () => {
  it('sert les appels sans réseau', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await saveSession({ kind: 'aidant', demo: true, accessToken: 'demo', refreshToken: 'demo', accessExpiresAt: Date.now() + 3_600_000, userId: 'demo-aidant', nomComplet: 'Salma (démo)' });
    expect((await aidantApi.seniors())[0]?.nomComplet).toBe('Hajja Zahra');
    await saveSession({ kind: 'senior', demo: true, deviceToken: 'demo', seniorId: DEMO_SENIOR_ID, nomComplet: 'Hajja Zahra' });
    expect((await seniorApi.profile(DEMO_SENIOR_ID)).nomComplet).toBe('Hajja Zahra');
    expect(fetchSpy).not.toHaveBeenCalled();
    await saveSession(null);
  });
});

describe('rapport PDF hebdomadaire de démo', () => {
  it('liste les prises de la semaine, le taux, les exercices et les mentions éthiques', async () => {
    const { html, patient } = await demoReportHtml(fr, DEMO_SENIOR_ID, new Date(2026, 10, 9), 'Bonne semaine <ok>', NOW);
    expect(patient).toBe('Hajja Zahra');
    expect(html).toContain('Rapport hebdomadaire de suivi des rappels');
    expect(html).toContain('Metformine 850 mg');
    expect(html.match(/<tr><td>/g)).toHaveLength(7 * 4);
    expect(html).toMatch(/Taux de confirmation \(rappels clôturés\) : \d+ %/);
    expect(html).toContain('Bonne semaine &lt;ok&gt;');
    expect(html).toContain('ne prouve pas la prise effective du médicament');
    expect(html).toContain('Données de démonstration fictives');
    expect(html).not.toMatch(/oubli/i);
    expect(Print.printToFileAsync).not.toHaveBeenCalled();
  });
});

describe('adresse du serveur', () => {
  it('teste la santé du backend à la racine de l’API', () => {
    expect(healthUrl('http://192.168.1.19:8088/api/v1/')).toBe('http://192.168.1.19:8088/actuator/health');
  });
});
