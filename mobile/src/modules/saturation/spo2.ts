/**
 * Règles d'alerte SpO2 au repos (identiques au backend, `Spo2Level`), appliquées tout de suite sur le
 * téléphone pour que l'alerte s'affiche même sans réseau. Pré-dépistage et orientation, pas un diagnostic.
 */
export type Spo2Level = 'VERT' | 'ORANGE' | 'ROUGE';

export const SPO2_MIN = 50;
export const SPO2_MAX = 100;
export const PULSE_MIN = 30;
export const PULSE_MAX = 220;
/** Numéros d'urgence proposés en alerte rouge : SAMU (15) et SAMU Maroc (141). */
export const EMERGENCY_NUMBERS = ['15', '141'] as const;

export const PROFILE_QUESTION =
  'Le patient souffre-t-il d’une maladie respiratoire chronique connue (ex : BPCO, insuffisance respiratoire) ?';

export function profileLabel(chronic: boolean): string {
  return chronic ? 'BPCO / insuffisance respiratoire (cible 88-92 %)' : 'Standard (cible 95-100 %)';
}

export function classifySpo2(spo2: number, chronic: boolean): Spo2Level {
  if (chronic) {
    if (spo2 < 85) return 'ROUGE';
    return spo2 >= 88 && spo2 <= 92 ? 'VERT' : 'ORANGE';
  }
  if (spo2 < 90) return 'ROUGE';
  return spo2 >= 95 ? 'VERT' : 'ORANGE';
}

export interface Spo2Advice {
  title: string;
  message: string;
}

export function spo2Advice(level: Spo2Level, chronic: boolean): Spo2Advice {
  if (level === 'ROUGE') {
    return {
      title: 'Urgence : manque d’oxygène critique',
      message: `Saturation en dessous de ${chronic ? 85 : 90} %. Appelez immédiatement les urgences (15 ou 141) et restez auprès du patient.`,
    };
  }
  if (level === 'ORANGE') {
    return chronic
      ? {
          title: 'Alerte : hors de la cible 88-92 %',
          message:
            'Faites reposer le patient, vérifiez le capteur (doigt froid, vernis à ongles, position) et recontrôlez dans 10 minutes. Si la valeur reste hors cible, contactez le médecin qui le suit.',
        }
      : {
          title: 'Alerte : saturation basse (90-94 %)',
          message:
            'Faites reposer le patient, vérifiez le capteur (doigt froid, vernis à ongles, position) et recontrôlez dans 10 minutes. Si la valeur reste basse, contactez un médecin.',
        };
  }
  return chronic
    ? { title: 'Dans la cible (88-92 %)', message: 'La saturation est dans la cible recommandée pour une maladie respiratoire chronique.' }
    : { title: 'Oxygénation normale (95-100 %)', message: 'La saturation est dans la zone habituelle au repos.' };
}

/** Valeurs saisies → nombres, ou message d'erreur. */
export function parseMeasurement(spo2Text: string, pulseText: string): { spo2: number; pouls: number } | string {
  const spo2 = Number(spo2Text.trim());
  const pouls = Number(pulseText.trim());
  if (!/^\d{2,3}$/.test(spo2Text.trim()) || spo2 < SPO2_MIN || spo2 > SPO2_MAX) {
    return `SpO2 : saisissez un nombre entier entre ${SPO2_MIN} et ${SPO2_MAX} %.`;
  }
  if (!/^\d{2,3}$/.test(pulseText.trim()) || pouls < PULSE_MIN || pouls > PULSE_MAX) {
    return `Pouls : saisissez un nombre entier entre ${PULSE_MIN} et ${PULSE_MAX} bpm.`;
  }
  return { spo2, pouls };
}
