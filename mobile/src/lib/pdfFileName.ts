/**
 * Nom explicite et horodaté des PDF partagés :
 * `NeuroCare_<Module>_<Patient>_<YYYY-MM-DD>_<HHhMM>.pdf` (heure locale du téléphone).
 * Logique pure, sans dépendance native (testée sans mock).
 */

/** Nom de chaque rapport dans le nom de fichier (ASCII, sans espace). */
export const PDF_MODULE_NAMES = {
  observance: 'Rappels-Suivi',
  saturation: 'Saturation-SpO2',
  mental: 'Sante-Mentale-GDS',
  metabolic: 'Diabete-FINDRISC',
  cardio: 'Tension-HTA',
  alzheimer: 'Alzheimer-4A',
} as const;

export type PdfModule = keyof typeof PDF_MODULE_NAMES;

/** Nom par défaut quand le patient n'est pas renseigné. */
export const DEFAULT_FILE_PATIENT = 'Patient';

const MAX_PATIENT_LENGTH = 60;

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Nettoie un fragment de nom de fichier : retire les caractères interdits (`/ \ : * ? " < > |`), `#` et `%`
 * (qui casseraient l'URI `file://`) et les caractères de contrôle, remplace les espaces par des tirets.
 * Les lettres accentuées et arabes sont conservées.
 */
export function sanitizeFileNamePart(value: string): string {
  return (
    value
      .replace(/[/\\:*?"<>|#%\u0000-\u001F\u007F]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[.\-_]+|[.\-_]+$/g, '')
      .slice(0, MAX_PATIENT_LENGTH)
      .replace(/[.\-_]+$/, '')
  );
}

/** « 2026-11-20_11h30 » en heure locale. */
export function fileTimestamp(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}h${pad(at.getMinutes())}`;
}

/** Ex. : `NeuroCare_Tension-HTA_Ahmed-Benali_2026-11-20_11h30.pdf`. */
export function pdfFileName(module: PdfModule, patient: string | null | undefined, at: Date): string {
  const name = sanitizeFileNamePart(patient ?? '') || DEFAULT_FILE_PATIENT;
  return `NeuroCare_${PDF_MODULE_NAMES[module]}_${name}_${fileTimestamp(at)}.pdf`;
}
