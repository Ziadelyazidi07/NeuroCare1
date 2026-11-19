/** Validation des saisies (mêmes règles que le backend). */

const E164 = /^\+[1-9]\d{7,14}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isE164(value: string): boolean {
  return E164.test(value);
}

/** Mêmes règles que le backend (POST /auth/register) ; null si le formulaire est valide. */
export function registrationError(form: {
  nomComplet: string;
  telephone: string;
  motDePasse: string;
  confirmation: string;
}): string | null {
  if (!form.nomComplet.trim()) return 'Indiquez votre nom complet.';
  if (form.nomComplet.trim().length > 120) return 'Le nom ne doit pas dépasser 120 caractères.';
  if (!isE164(form.telephone)) return 'Numéro invalide. Exemple : 06 12 34 56 78 ou +212612345678.';
  if (form.motDePasse.length < 8 || form.motDePasse.length > 72) return 'Le mot de passe doit contenir entre 8 et 72 caractères.';
  if (form.motDePasse !== form.confirmation) return 'Les deux mots de passe ne sont pas identiques.';
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
