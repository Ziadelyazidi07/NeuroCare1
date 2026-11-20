/**
 * Règles d'alerte SpO2 au repos (identiques au backend, `Spo2Level`), appliquées tout de suite sur le
 * téléphone pour que l'alerte s'affiche même sans réseau. Pré-dépistage et orientation, pas un diagnostic.
 */
export type Spo2Level = 'VERT' | 'ORANGE' | 'ROUGE';

export const SPO2_MIN = 50;
export const SPO2_MAX = 100;
export const PULSE_MIN = 30;
export const PULSE_MAX = 220;

export function classifySpo2(spo2: number, chronic: boolean): Spo2Level {
  if (chronic) {
    if (spo2 < 85) return 'ROUGE';
    return spo2 >= 88 && spo2 <= 92 ? 'VERT' : 'ORANGE';
  }
  if (spo2 < 90) return 'ROUGE';
  return spo2 >= 95 ? 'VERT' : 'ORANGE';
}

/** Valeurs saisies → nombres, ou code d'erreur (message : `t.spo2.errors`). */
export function parseMeasurement(spo2Text: string, pulseText: string): { spo2: number; pouls: number } | 'SPO2' | 'PULSE' {
  const spo2 = Number(spo2Text.trim());
  const pouls = Number(pulseText.trim());
  if (!/^\d{2,3}$/.test(spo2Text.trim()) || spo2 < SPO2_MIN || spo2 > SPO2_MAX) {
    return 'SPO2';
  }
  if (!/^\d{2,3}$/.test(pulseText.trim()) || pouls < PULSE_MIN || pouls > PULSE_MAX) {
    return 'PULSE';
  }
  return { spo2, pouls };
}
