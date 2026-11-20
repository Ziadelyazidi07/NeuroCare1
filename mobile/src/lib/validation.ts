/** Validation des saisies (mêmes règles que le backend). */

const E164 = /^\+[1-9]\d{7,14}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isE164(value: string): boolean {
  return E164.test(value);
}

/** Code d'erreur d'inscription (message : `t.registration`). */
export type RegistrationError = 'NOM' | 'NOM_LONG' | 'TELEPHONE' | 'MOT_DE_PASSE' | 'CONFIRMATION';

/** Mêmes règles que le backend (POST /auth/register) ; null si le formulaire est valide. */
export function registrationError(form: {
  nomComplet: string;
  telephone: string;
  motDePasse: string;
  confirmation: string;
}): RegistrationError | null {
  if (!form.nomComplet.trim()) return 'NOM';
  if (form.nomComplet.trim().length > 120) return 'NOM_LONG';
  if (!isE164(form.telephone)) return 'TELEPHONE';
  if (form.motDePasse.length < 8 || form.motDePasse.length > 72) return 'MOT_DE_PASSE';
  if (form.motDePasse !== form.confirmation) return 'CONFIRMATION';
  return null;
}

/**
 * Normalise un numéro marocain saisi naturellement : « 06 12 34 56 78 » → « +212612345678 ».
 * Un numéro déjà au format international est conservé tel quel (espaces retirés).
 */
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s.-]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return '+' + compact.slice(2);
  if (/^0[5-7]\d{8}$/.test(compact)) return '+212' + compact.slice(1);
  return compact;
}

/** « 8:05 » ou « 08:05 » → « 08:05 » ; null si invalide. */
export function parseHHMM(input: string): string | null {
  const trimmed = input.trim();
  const padded = /^\d:\d{2}$/.test(trimmed) ? '0' + trimmed : trimmed;
  return HHMM.test(padded) ? padded : null;
}

export function isSixDigitCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}
