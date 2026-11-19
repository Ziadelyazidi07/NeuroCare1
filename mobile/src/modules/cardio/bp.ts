/**
 * Règles d'alerte tensionnelle et protocole d'automesure (mêmes seuils que le backend, `BpLevel` /
 * `BpAverage`), appliqués tout de suite sur le téléphone, même hors ligne. Pré-dépistage, pas un diagnostic.
 */
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

/** Saisie → valeurs, ou message d'erreur. */
export function parseBp(tasText: string, tadText: string, pulseText: string): BpValues | string {
  const [tas, tad, pouls] = [tasText, tadText, pulseText].map((t) => (/^\d{2,3}$/.test(t.trim()) ? Number(t.trim()) : NaN));
  if (!inRange(tas, TAS_RANGE)) return 'Systolique (TAS, le grand chiffre) : entre 60 et 260 mmHg.';
  if (!inRange(tad, TAD_RANGE)) return 'Diastolique (TAD, le petit chiffre) : entre 30 et 160 mmHg.';
  if (tad >= tas) return 'La systolique (grand chiffre) doit être supérieure à la diastolique.';
  if (!inRange(pouls, PULSE_RANGE)) return 'Pouls : entre 30 et 220 battements par minute.';
  return { tas, tad, pouls };
}

export const ELDERLY_NOTE =
  'Note : après 80 ans, une systolique jusqu’à 140-145 mmHg peut être tolérée selon l’avis du médecin.';

export const BP_ADVICE: Record<BpLevel, { title: string; message: string }> = {
  URGENCE_HYPERTENSIVE: {
    title: 'Alerte rouge : tension très élevée (≥ 180/110)',
    message:
      'Restez au calme, assis. Vérifiez les symptômes ci-dessous : au moindre symptôme, appelez immédiatement le 15 ou le 141. Sans symptôme, refaites une mesure dans 5 minutes et contactez rapidement un médecin.',
  },
  HYPOTENSION: {
    title: 'Alerte orange : tension basse (TAS < 100)',
    message:
      'Risque de malaise et de chute : allongez-vous, buvez un verre d’eau, puis relevez-vous lentement en vérifiant que la position debout est bien supportée. Signalez-le au médecin si cela se répète.',
  },
  TENSION_ELEVEE: {
    title: 'Vigilance : valeurs compatibles avec une HTA modérée (135-179 / 85-109)',
    message:
      'Une mesure isolée ne suffit pas : suivez le protocole d’automesure sur 3 jours pour un relevé fiable, et limitez le sel en attendant l’avis du médecin.',
  },
  NORMALE: { title: 'Tension normale (< 135/85)', message: 'Les valeurs sont dans la zone habituelle à domicile.' },
};

export const SYMPTOMS = [
  'Maux de tête violents',
  'Douleur dans la poitrine',
  'Essoufflement',
  'Trouble de la parole ou de la vision',
] as const;

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

export function slotLabel(s: Slot): string {
  return `Jour ${s.jour} · ${s.moment === 'MATIN' ? 'Matin' : 'Soir'} · M${s.rang}`;
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

export const PROTOCOL_INSTRUCTIONS = [
  'Assis, dos appuyé, bras posé sur la table, brassard à hauteur du cœur, après 5 minutes de repos.',
  'Matin : avant le petit-déjeuner et avant la prise des médicaments.',
  'Soir : avant le coucher.',
  'À chaque fois, 3 mesures (M1, M2, M3) espacées de 1 à 2 minutes.',
];

/** « 12/11 » → libellé d'une date locale AAAA-MM-JJ décalée de `offset` jours. */
export function protocolDay(dateDebut: string, offset: number): string {
  const d = new Date(`${dateDebut}T12:00:00`);
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function formatAverage(avg: { tas: number; tad: number }): string {
  return `${avg.tas.toFixed(1).replace('.', ',')} / ${avg.tad.toFixed(1).replace('.', ',')} mmHg`;
}
