/**
 * Règles d'alerte tensionnelle et protocole d'automesure (mêmes seuils que le backend, `BpLevel` /
 * `BpAverage`), appliqués tout de suite sur le téléphone, même hors ligne. Pré-dépistage, pas un diagnostic.
 */
import type { Dictionary } from '../../i18n';

export type BpLevel = 'URGENCE_HYPERTENSIVE' | 'HYPOTENSION' | 'TENSION_ELEVEE' | 'NORMALE';
export type Moment = 'MATIN' | 'SOIR';

export const TAS_RANGE = [60, 260] as const;
export const TAD_RANGE = [30, 160] as const;
export const PULSE_RANGE = [30, 220] as const;
export const PROTOCOL_SIZE = 18;
export const AVERAGE_THRESHOLD = { tas: 135, tad: 85 } as const;

export function classifyBp(tas: number, tad: number): BpLevel {
  if (tas >= 180 || tad >= 110) return 'URGENCE_HYPERTENSIVE';
  if (tas < 100) return 'HYPOTENSION';
  if (tas >= 135 || tad >= 85) return 'TENSION_ELEVEE';
  return 'NORMALE';
}

export interface BpValues {
  tas: number;
  tad: number;
  pouls: number;
}

const inRange = (value: number, [min, max]: readonly [number, number]) => value >= min && value <= max;

/** Code d'erreur de saisie (message : `t.bp.errors`). */
export type BpError = 'TAS' | 'TAD' | 'ORDRE' | 'POULS';

/** Saisie → valeurs, ou code d'erreur. */
export function parseBp(tasText: string, tadText: string, pulseText: string): BpValues | BpError {
  const [tas, tad, pouls] = [tasText, tadText, pulseText].map((t) => (/^\d{2,3}$/.test(t.trim()) ? Number(t.trim()) : NaN));
  if (!inRange(tas, TAS_RANGE)) return 'TAS';
  if (!inRange(tad, TAD_RANGE)) return 'TAD';
  if (tad >= tas) return 'ORDRE';
  if (!inRange(pouls, PULSE_RANGE)) return 'POULS';
  return { tas, tad, pouls };
}

/** Symptômes de la check-list d'urgence (libellés : `t.bp.symptoms`). */
export const SYMPTOMS = ['MAUX_DE_TETE', 'POITRINE', 'ESSOUFFLEMENT', 'PAROLE_VISION'] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export interface Slot {
  jour: 1 | 2 | 3;
  moment: Moment;
  rang: 1 | 2 | 3;
}

/** Les 18 créneaux du protocole, dans l'ordre de saisie. */
export const PROTOCOL_SLOTS: Slot[] = ([1, 2, 3] as const).flatMap((jour) =>
  (['MATIN', 'SOIR'] as const).flatMap((moment) => ([1, 2, 3] as const).map((rang) => ({ jour, moment, rang }))),
);

export const slotKey = (s: { jour?: number | null; moment?: Moment | null; rang?: number | null }) => `${s.jour}-${s.moment}-${s.rang}`;

export function slotLabel(t: Dictionary, s: Slot): string {
  return t.bp.slotLabel(s.jour, t.bp.moment[s.moment], s.rang);
}

/** Premier créneau sans mesure, ou null si les 18 sont saisis. */
export function nextEmptySlot(measures: { jour?: number | null; moment?: Moment | null; rang?: number | null }[]): Slot | null {
  const done = new Set(measures.map(slotKey));
  return PROTOCOL_SLOTS.find((s) => !done.has(slotKey(s))) ?? null;
}

export interface BpAverage {
  tas: number;
  tad: number;
  pouls: number;
  count: number;
  complete: boolean;
  /** Moyenne ≥ 135/85 : relevé à montrer au médecin. */
  elevated: boolean;
}

const mean = (values: number[]) => Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;

export function averageOf(measures: BpValues[]): BpAverage | null {
  if (measures.length === 0) return null;
  const tas = mean(measures.map((m) => m.tas));
  const tad = mean(measures.map((m) => m.tad));
  return {
    tas,
    tad,
    pouls: mean(measures.map((m) => m.pouls)),
    count: measures.length,
    complete: measures.length === PROTOCOL_SIZE,
    elevated: tas >= AVERAGE_THRESHOLD.tas || tad >= AVERAGE_THRESHOLD.tad,
  };
}

/** « 12/11 » → libellé d'une date locale AAAA-MM-JJ décalée de `offset` jours. */
export function protocolDay(dateDebut: string, offset: number): string {
  const d = new Date(`${dateDebut}T12:00:00`);
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Nombre à une décimale avec virgule (« 142,5 »). */
export function decimal(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function formatAverage(avg: { tas: number; tad: number }, unit: string): string {
  return `${decimal(avg.tas)} / ${decimal(avg.tad)} ${unit}`;
}
