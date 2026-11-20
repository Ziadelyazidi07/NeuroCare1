/** Mesures ponctuelles et protocoles d'automesure sur 3 jours, stockés sur le téléphone. */
import { newId, prepend, readJson, updateJson } from '../storage';
import { classifyBp, slotKey, type BpLevel, type BpValues, type Moment, type Slot } from './bp';

const MEASURES_KEY = 'neurocare.bp.measures';
const SERIES_KEY = 'neurocare.bp.series';
/** Protocoles conservés (le plus récent d'abord). */
const MAX_SERIES = 20;

export interface BpMeasurement extends BpValues {
  id: string;
  dateMesure: string;
  niveau: BpLevel;
  jour?: number | null;
  moment?: Moment | null;
  rang?: number | null;
}

export interface BpSeries {
  id: string;
  /** Jour 1 du protocole (AAAA-MM-JJ, date locale). */
  dateDebut: string;
  creeLe: string;
  mesures: BpMeasurement[];
}

function measurement(values: BpValues, now: Date, slot?: Slot): BpMeasurement {
  return { id: newId(), dateMesure: now.toISOString(), ...values, niveau: classifyBp(values.tas, values.tad), ...slot };
}

export function loadMeasures(): Promise<BpMeasurement[]> {
  return readJson<BpMeasurement[]>(MEASURES_KEY, []);
}

export function addMeasure(values: BpValues, now = new Date()): Promise<BpMeasurement> {
  const m = measurement(values, now);
  return updateJson<BpMeasurement[], BpMeasurement>(MEASURES_KEY, [], (list) => ({ value: prepend(list, m), result: m }));
}

export function loadSeries(): Promise<BpSeries[]> {
  return readJson<BpSeries[]>(SERIES_KEY, []);
}

export function startSeries(dateDebut: string, now = new Date()): Promise<BpSeries> {
  const series: BpSeries = { id: newId(), dateDebut, creeLe: now.toISOString(), mesures: [] };
  return updateJson<BpSeries[], BpSeries>(SERIES_KEY, [], (list) => ({ value: [series, ...list].slice(0, MAX_SERIES), result: series }));
}

/** Enregistre la mesure d'un créneau du protocole ; une ressaisie remplace la mesure du même créneau. */
export function recordSlot(serieId: string, slot: Slot, values: BpValues, now = new Date()): Promise<BpMeasurement> {
  const m = measurement(values, now, slot);
  return updateJson<BpSeries[], BpMeasurement>(SERIES_KEY, [], (list) => {
    if (!list.some((s) => s.id === serieId)) throw new Error('Protocole introuvable.');
    const order = (x: BpMeasurement) => `${x.jour}-${x.moment === 'MATIN' ? 0 : 1}-${x.rang}`;
    return {
      value: list.map((s) =>
        s.id !== serieId
          ? s
          : { ...s, mesures: [...s.mesures.filter((x) => slotKey(x) !== slotKey(slot)), m].sort((a, b) => order(a).localeCompare(order(b))) },
      ),
      result: m,
    };
  });
}
