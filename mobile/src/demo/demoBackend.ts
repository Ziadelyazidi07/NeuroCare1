/**
 * Serveur local du mode démo hors ligne : répond aux mêmes routes que l'API /api/v1 du Module 1, avec les
 * données de `demoData.ts` gardées dans AsyncStorage. Les écrans ne changent pas : le client HTTP aiguille
 * ici quand la session est une session de démo. Les mêmes règles s'appliquent (fenêtre de confirmation de
 * 30 min, consentements requis, « Sans réponse » jamais présenté comme un oubli).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ConsentType,
  DashboardHistory,
  DashboardToday,
  DoseDto,
  MedicationDto,
  MedicationRequest,
  SeniorDto,
  SyncResponse,
} from '../api/types';
import { CONFIRM_WINDOW_BEFORE_MS, pillColour } from '../lib/doses';
import type { PendingConfirmation } from '../lib/offlineQueue';
import { ApiError } from '../lib/problem';
import {
  DEMO_AIDANT,
  DEMO_LIVE_MEDICATION_ID,
  DEMO_SENIOR_ID,
  DEMO_WORDS,
  addDays,
  dosesBetween,
  localDay,
  seedState,
  soonTime,
  startOfDay,
  type DemoState,
} from './demoData';
import { emitDemoEvent } from './demoEvents';

const KEY = 'neurocare.demo.state';
const AVERTISSEMENT = 'Données de démonstration fictives. Une confirmation ne prouve pas la prise du médicament.';
let cached: DemoState | null = null;
let counter = 0;

async function load(): Promise<DemoState> {
  if (cached) return cached;
  const raw = await AsyncStorage.getItem(KEY);
  cached = raw ? (JSON.parse(raw) as DemoState) : seedState();
  return cached;
}

async function save(state: DemoState): Promise<void> {
  cached = state;
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function notFound(): ApiError {
  return new ApiError(404, 'NOT_FOUND', 'Ressource introuvable.');
}

function requireConsent(state: DemoState, seniorId: string, type: ConsentType): void {
  if (!state.consents[seniorId]?.some((c) => c.type === type && c.accorde)) {
    throw new ApiError(403, 'CONSENT_REQUIRED', 'Consentement du senior requis pour cette fonction.');
  }
}

/**
 * Prépare la démo : données créées au premier passage (ou si `reset`), et un rappel « Vitamine D3 » recalé
 * dans 2 minutes s'il n'y a plus de prise à confirmer, pour montrer l'alerte et le bouton « C'est fait ».
 */
export async function prepareDemo(reset = false, now = new Date()): Promise<void> {
  const state = reset ? seedState(now) : await load();
  const window = dosesBetween(state, DEMO_SENIOR_ID, new Date(now.getTime() - 30 * 60_000), new Date(now.getTime() + 30 * 60_000), now);
  if (!window.some((d) => d.statut === 'EN_ATTENTE')) {
    state.medications = state.medications.map((m) =>
      m.id === DEMO_LIVE_MEDICATION_ID ? { ...m, horaires: [{ id: `${m.id}-h0`, heure: soonTime(now), jours: m.horaires[0]?.jours ?? [] }] } : m,
    );
  }
  await save(state);
}

/** Efface les données de démo (elles seront recréées à la prochaine entrée). */
export async function clearDemo(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(KEY);
}

/** Données du rapport hebdomadaire (rapport généré sur le téléphone en démo). */
export async function demoWeek(seniorId: string, weekStart: Date): Promise<{ senior: SeniorDto; doses: DoseDto[]; exercises: DemoState['exercises'] }> {
  const state = await load();
  const senior = state.seniors.find((s) => s.id === seniorId);
  if (!senior) throw notFound();
  const from = startOfDay(weekStart);
  const to = new Date(addDays(from, 7).getTime() - 1);
  return {
    senior,
    doses: dosesBetween(state, seniorId, from, to),
    exercises: state.exercises.filter((e) => e.seniorId === seniorId && e.dateExercice >= from.toISOString() && e.dateExercice <= to.toISOString()),
  };
}

function confirmOne(state: DemoState, seniorId: string, doseId: string, at: string, now: Date): DoseDto {
  const [medicationId, stamp] = doseId.split('@');
  const day = stamp ? new Date(stamp) : null;
  if (!day || Number.isNaN(day.getTime())) throw notFound();
  const dose = dosesBetween(state, seniorId, new Date(day.getTime() - 60_000), new Date(day.getTime() + 60_000), now).find((d) => d.id === doseId);
  if (!dose || dose.medicationId !== medicationId) throw notFound();
  if (dose.statut === 'CONFIRME') return dose;
  if (dose.statut !== 'EN_ATTENTE' || new Date(dose.datePrevue).getTime() - now.getTime() > CONFIRM_WINDOW_BEFORE_MS) {
    throw new ApiError(409, 'DOSE_NOT_CONFIRMABLE', 'Cette prise ne peut plus être confirmée.');
  }
  const updated: DoseDto = { ...dose, statut: 'CONFIRME', horodatageAction: at };
  state.statuses[doseId] = { statut: 'CONFIRME', horodatageAction: at };
  emitDemoEvent({
    type: 'DOSE_STATUS_CHANGED',
    doseId,
    seniorId,
    medication: dose.nomMedicament,
    datePrevue: dose.datePrevue,
    statut: 'CONFIRME',
    couleur: 'VERT',
  });
  return updated;
}

function today(state: DemoState, seniorId: string, now: Date): DashboardToday {
  const doses = dosesBetween(state, seniorId, startOfDay(now), new Date(addDays(startOfDay(now), 1).getTime() - 1), now);
  const count = (statut: DoseDto['statut']) => doses.filter((d) => d.statut === statut).length;
  const last = state.exercises.filter((e) => e.seniorId === seniorId).sort((a, b) => b.dateExercice.localeCompare(a.dateExercice))[0];
  return {
    seniorId,
    date: localDay(now),
    prises: doses.map((d) => ({
      doseId: d.id,
      medicationId: d.medicationId,
      nomMedicament: d.nomMedicament,
      consigne: d.consigne,
      datePrevue: d.datePrevue,
      statut: d.statut,
      couleur: pillColour(d.statut),
      horodatageAction: d.horodatageAction,
    })),
    resume: { total: doses.length, confirmees: count('CONFIRME'), sansReponse: count('SANS_REPONSE'), enAttente: count('EN_ATTENTE'), desactivees: count('DESACTIVE') },
    dernierExercice: last && { sessionId: last.id, dateExercice: last.dateExercice, motsPresentes: last.motsPresentes, corrects: last.corrects, interrompu: last.interrompu },
    avertissement: AVERTISSEMENT,
  };
}

function history(state: DemoState, seniorId: string, days: number, now: Date): DashboardHistory {
  const first = addDays(startOfDay(now), -(days - 1));
  const jours = Array.from({ length: days }, (_, i) => {
    const day = addDays(first, i);
    const doses = dosesBetween(state, seniorId, day, new Date(addDays(day, 1).getTime() - 1), now);
    const count = (statut: DoseDto['statut']) => doses.filter((d) => d.statut === statut).length;
    const confirmees = count('CONFIRME');
    const sansReponse = count('SANS_REPONSE');
    return {
      date: localDay(day),
      confirmees,
      sansReponse,
      enAttente: count('EN_ATTENTE'),
      desactivees: count('DESACTIVE'),
      tauxConfirmation: confirmees + sansReponse ? (100 * confirmees) / (confirmees + sansReponse) : undefined,
    };
  });
  const closed = jours.reduce((sum, j) => sum + j.confirmees + j.sansReponse, 0);
  const exercices = state.exercises
    .filter((e) => e.seniorId === seniorId && e.dateExercice >= first.toISOString())
    .map((e) => ({ ...e, tauxReussite: e.motsPresentes ? (100 * e.corrects) / e.motsPresentes : undefined }));
  return {
    du: localDay(first),
    au: localDay(now),
    jours,
    tauxConfirmationPeriode: closed ? (100 * jours.reduce((sum, j) => sum + j.confirmees, 0)) / closed : undefined,
    exercices,
    avertissement: AVERTISSEMENT,
  };
}

function medicationFrom(seniorId: string, body: MedicationRequest, id = newId('demo-med')): MedicationDto {
  return {
    id,
    seniorId,
    nomMedicament: body.nomMedicament,
    consigne: body.consigne,
    dateDebut: body.dateDebut,
    dateFin: body.dateFin,
    actif: true,
    horaires: body.horaires.map((h, i) => ({ id: `${id}-h${i}`, ...h })),
  };
}

/**
 * Exécute une requête de l'API sur les données locales. `seniorId` est celui de la session senior
 * (routes /me/...). Les routes inconnues répondent 404, comme le serveur.
 */
export async function demoRequest<T>(method: string, path: string, body: unknown, sessionSeniorId: string | undefined, now = new Date()): Promise<T> {
  const state = await load();
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const parts = route.split('/').filter(Boolean);
  const is = (m: string, pattern: string) => {
    if (m !== method) return false;
    const p = pattern.split('/').filter(Boolean);
    return p.length === parts.length && p.every((seg, i) => seg.startsWith(':') || seg === parts[i]);
  };
  const result = async (value: unknown, changed = false): Promise<T> => {
    if (changed) await save(state);
    return value as T;
  };
  const senior = (id: string) => {
    const found = state.seniors.find((s) => s.id === id);
    if (!found) throw notFound();
    return found;
  };
  const me = () => {
    if (!sessionSeniorId) throw new ApiError(401, 'UNAUTHORIZED', 'Session expirée.');
    return sessionSeniorId;
  };
  const b = (body ?? {}) as Record<string, unknown>;

  // Authentification
  if (is('POST', '/auth/login')) {
    return result({ accessToken: 'demo', refreshToken: 'demo', expiresIn: 86_400, user: { ...DEMO_AIDANT, role: 'AIDANT' } });
  }
  if (is('POST', '/auth/register')) return result({ ...DEMO_AIDANT, role: 'AIDANT' });
  if (is('POST', '/auth/logout')) return result(undefined);
  if (is('POST', '/auth/pairing/redeem')) return result({ deviceToken: 'demo', seniorId: DEMO_SENIOR_ID, nomComplet: senior(DEMO_SENIOR_ID).nomComplet });

  // Espace senior
  if (is('GET', '/me/doses/upcoming')) {
    const hours = Number(params.get('hours') ?? 48);
    return result(dosesBetween(state, me(), startOfDay(now), new Date(now.getTime() + hours * 3_600_000), now));
  }
  if (is('POST', '/doses/:id/confirm')) {
    const dose = confirmOne(state, me(), decodeURIComponent(parts[1] ?? ''), String(b.horodatageClient ?? now.toISOString()), now);
    return result(dose, true);
  }
  if (is('POST', '/me/doses/sync')) {
    const items = (b.confirmations ?? []) as PendingConfirmation[];
    const resultats: SyncResponse['resultats'] = items.map((item) => {
      try {
        const before = dosesBetween(state, me(), startOfDay(addDays(now, -2)), addDays(now, 2), now).find((d) => d.id === item.doseId);
        const dose = confirmOne(state, me(), item.doseId, item.horodatageClient, now);
        return { doseId: item.doseId, clientRequestId: item.clientRequestId, resultat: before?.statut === 'CONFIRME' ? 'DEJA_APPLIQUEE' : 'APPLIQUEE', statut: dose.statut };
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        return { doseId: item.doseId, clientRequestId: item.clientRequestId, resultat: status === 404 ? 'INTROUVABLE' : 'REFUSEE' };
      }
    });
    return result({ resultats }, true);
  }
  // Voix clonée : pas de fichier en démo, le téléphone joue la tonalité de rappel.
  if (is('GET', '/me/medications/:id/audio')) throw notFound();
  if (is('POST', '/me/devices')) return result(undefined);
  if (is('GET', '/me/cognitive/next')) {
    requireConsent(state, me(), 'EXERCICES');
    const n = Number(params.get('nombre') ?? 3);
    const offset = new Date(now).getDate() % DEMO_WORDS.length;
    const words = [...DEMO_WORDS.slice(offset), ...DEMO_WORDS.slice(0, offset)];
    return result({ type: 'RAPPEL_MOTS', langue: senior(me()).langue, motsPresentes: words.slice(0, n), propositions: words, delaiRappelSec: 10, facultatif: true });
  }
  if (is('POST', '/me/cognitive/sessions')) {
    const presented = (b.motsPresentes as string[] | undefined) ?? [];
    const chosen = (b.motsChoisis as string[] | undefined) ?? [];
    const session = {
      seniorId: me(),
      id: newId('demo-ex'),
      dateExercice: now.toISOString(),
      motsPresentes: presented.length,
      corrects: chosen.filter((w) => presented.includes(w)).length,
      interrompu: Boolean(b.interrompu),
    };
    state.exercises.push(session);
    emitDemoEvent({ type: 'COGNITIVE_SESSION_COMPLETED', sessionId: session.id, seniorId: session.seniorId, dateExercice: session.dateExercice, interrompu: session.interrompu });
    const { seniorId: _omit, ...dto } = session;
    return result(dto, true);
  }

  // Espace aidant
  if (is('GET', '/seniors')) return result(state.seniors);
  if (is('POST', '/seniors')) {
    const created: SeniorDto = {
      id: newId('demo-senior'),
      nomComplet: String(b.nomComplet ?? ''),
      langue: (b.langue as SeniorDto['langue']) ?? 'DARIJA',
      fuseau: 'Africa/Casablanca',
      taillePolice: 28,
      contrasteEleve: true,
      delaiSansReponseMin: 60,
      contactUrgenceNom: b.contactUrgenceNom as string | undefined,
      contactUrgenceTel: b.contactUrgenceTel as string | undefined,
      donneesFictives: true,
      anneeNaissance: b.anneeNaissance as number | undefined,
      lien: { lienParente: b.lienParente as string | undefined, surnomSenior: b.surnomSenior as string | undefined, consentementValide: false },
    };
    state.seniors.push(created);
    state.consents[created.id] = [];
    return result(created, true);
  }
  if (is('GET', '/seniors/:id')) return result(senior(parts[1] ?? ''));
  if (is('POST', '/seniors/:id/pairing-codes')) {
    senior(parts[1] ?? '');
    return result({ code: String(100000 + Math.floor(Math.random() * 900000)), expireLe: new Date(now.getTime() + 10 * 60_000).toISOString() });
  }
  if (is('GET', '/seniors/:id/devices')) return result(state.devices[parts[1] ?? ''] ?? []);
  if (is('DELETE', '/seniors/:id/devices/:deviceId')) {
    const id = parts[1] ?? '';
    state.devices[id] = (state.devices[id] ?? []).map((d) => (d.id === parts[3] ? { ...d, revoque: true } : d));
    return result(undefined, true);
  }
  if (is('GET', '/seniors/:id/dashboard/today')) {
    requireConsent(state, senior(parts[1] ?? '').id, 'PARTAGE_FAMILIAL');
    return result(today(state, parts[1] ?? '', now));
  }
  if (is('GET', '/seniors/:id/dashboard/history')) {
    requireConsent(state, senior(parts[1] ?? '').id, 'PARTAGE_FAMILIAL');
    return result(history(state, parts[1] ?? '', Math.min(31, Math.max(1, Number(params.get('days') ?? 7))), now));
  }
  if (is('GET', '/seniors/:id/medications')) return result(state.medications.filter((m) => m.seniorId === senior(parts[1] ?? '').id));
  if (is('POST', '/seniors/:id/medications')) {
    const seniorId = senior(parts[1] ?? '').id;
    requireConsent(state, seniorId, 'RAPPELS');
    const created = medicationFrom(seniorId, body as MedicationRequest);
    state.medications.push(created);
    emitDemoEvent({ type: 'REMINDERS_UPDATED', seniorId });
    return result(created, true);
  }
  if (is('PUT', '/medications/:id') || is('PATCH', '/medications/:id/deactivate')) {
    const existing = state.medications.find((m) => m.id === parts[1]);
    if (!existing) throw notFound();
    const updated = method === 'PUT' ? { ...medicationFrom(existing.seniorId, body as MedicationRequest, existing.id), actif: existing.actif } : { ...existing, actif: false };
    state.medications = state.medications.map((m) => (m.id === existing.id ? updated : m));
    emitDemoEvent({ type: 'REMINDERS_UPDATED', seniorId: existing.seniorId });
    return result(updated, true);
  }
  if (is('GET', '/seniors/:id/consents')) return result(state.consents[senior(parts[1] ?? '').id] ?? []);
  if (is('GET', '/seniors/:id/consents/history')) {
    const id = senior(parts[1] ?? '').id;
    return result(state.consentHistory.filter((h) => h.seniorId === id).map(({ seniorId: _omit, ...h }) => h));
  }
  if (is('PUT', '/seniors/:id/consents/:type')) {
    const target = senior(parts[1] ?? '');
    const type = parts[3] as ConsentType;
    const accorde = Boolean(b.accorde);
    const dto = { type, accorde, versionTexte: String(b.versionTexte ?? 'v1'), dateMaj: now.toISOString() };
    state.consents[target.id] = [...(state.consents[target.id] ?? []).filter((c) => c.type !== type), dto];
    state.consentHistory.push({ seniorId: target.id, type, accorde, versionTexte: dto.versionTexte, auteurId: DEMO_AIDANT.id, canal: 'APP_AIDANT', horodatage: dto.dateMaj });
    if (type === 'PARTAGE_FAMILIAL') {
      state.seniors = state.seniors.map((s) => (s.id === target.id ? { ...s, lien: { ...s.lien, consentementValide: accorde, dateConsentement: dto.dateMaj } } : s));
    }
    return result(dto, true);
  }
  if (is('GET', '/seniors/:id/voice-profile')) {
    const voice = state.voices[senior(parts[1] ?? '').id];
    if (!voice) throw notFound();
    return result(voice);
  }
  if (is('POST', '/seniors/:id/voice-profile')) {
    const id = senior(parts[1] ?? '').id;
    requireConsent(state, id, 'VOIX');
    state.voices[id] = { id: newId('demo-voice'), statut: 'PRET', dateCreation: now.toISOString() };
    emitDemoEvent({ type: 'VOICE_PROFILE_READY', voiceProfileId: state.voices[id].id, seniorId: id, statut: 'PRET' });
    return result(state.voices[id], true);
  }
  if (is('DELETE', '/seniors/:id/voice-profile')) {
    state.voices[senior(parts[1] ?? '').id] = null;
    return result(undefined, true);
  }
  throw notFound();
}
