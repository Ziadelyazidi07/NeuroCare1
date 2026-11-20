/** Profil respiratoire et mesures SpO2, stockés sur le téléphone. */
import { newId, prepend, readJson, updateJson, writeJson } from '../storage';
import { classifySpo2, type Spo2Level } from './spo2';

const PROFILE_KEY = 'neurocare.spo2.profile';
const MEASURES_KEY = 'neurocare.spo2.measures';

export interface Spo2Measurement {
  id: string;
  dateMesure: string;
  spo2: number;
  pouls: number;
  maladieRespiratoireChronique: boolean;
  niveau: Spo2Level;
}

/** null tant que la question du profil respiratoire n'a pas été posée. */
export function loadProfile(): Promise<boolean | null> {
  return readJson<boolean | null>(PROFILE_KEY, null);
}

export function saveProfile(chronic: boolean): Promise<void> {
  return writeJson(PROFILE_KEY, chronic);
}

export function loadMeasures(): Promise<Spo2Measurement[]> {
  return readJson<Spo2Measurement[]>(MEASURES_KEY, []);
}

/** Classe la mesure selon le profil et l'ajoute à l'historique (la plus récente d'abord). */
export function addMeasure(values: { spo2: number; pouls: number }, chronic: boolean, now = new Date()): Promise<Spo2Measurement> {
  const measure: Spo2Measurement = {
    id: newId(),
    dateMesure: now.toISOString(),
    ...values,
    maladieRespiratoireChronique: chronic,
    niveau: classifySpo2(values.spo2, chronic),
  };
  return updateJson<Spo2Measurement[], Spo2Measurement>(MEASURES_KEY, [], (list) => ({ value: prepend(list, measure), result: measure }));
}
