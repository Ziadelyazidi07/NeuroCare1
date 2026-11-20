import { describe, expect, it } from '@jest/globals';

import { PDF_MODULE_NAMES, fileTimestamp, pdfFileName, sanitizeFileNamePart } from '../pdfFileName';

// Date locale (le nom du fichier suit l'heure du téléphone).
const at = new Date(2026, 10, 20, 11, 30, 42);

describe('nom des fichiers PDF', () => {
  it('suit le format NeuroCare_<Module>_<Patient>_<YYYY-MM-DD>_<HHhMM>.pdf', () => {
    expect(pdfFileName('cardio', 'Ahmed Benali', at)).toBe('NeuroCare_Tension-HTA_Ahmed-Benali_2026-11-20_11h30.pdf');
    expect(pdfFileName('saturation', '', new Date(2026, 10, 20, 11, 35))).toBe('NeuroCare_Saturation-SpO2_Patient_2026-11-20_11h35.pdf');
  });

  it('nomme chacun des 6 rapports', () => {
    expect(Object.keys(PDF_MODULE_NAMES).map((m) => pdfFileName(m as keyof typeof PDF_MODULE_NAMES, null, at))).toEqual([
      'NeuroCare_Rappels-Suivi_Patient_2026-11-20_11h30.pdf',
      'NeuroCare_Saturation-SpO2_Patient_2026-11-20_11h30.pdf',
      'NeuroCare_Sante-Mentale-GDS_Patient_2026-11-20_11h30.pdf',
      'NeuroCare_Diabete-FINDRISC_Patient_2026-11-20_11h30.pdf',
      'NeuroCare_Tension-HTA_Patient_2026-11-20_11h30.pdf',
      'NeuroCare_Alzheimer-4A_Patient_2026-11-20_11h30.pdf',
    ]);
  });

  it('complète heures et minutes sur deux chiffres', () => {
    expect(fileTimestamp(new Date(2026, 0, 5, 7, 4))).toBe('2026-01-05_07h04');
  });

  it('retire les caractères interdits mais garde le nom du patient', () => {
    expect(sanitizeFileNamePart('A/b\\c:d*e?f"g<h>i|j')).toBe('Abcdefghij');
    expect(sanitizeFileNamePart('  Fatima   Zahra  ')).toBe('Fatima-Zahra');
    expect(sanitizeFileNamePart('Benoît Lefèvre')).toBe('Benoît-Lefèvre');
    expect(sanitizeFileNamePart('أحمد بنعلي')).toBe('أحمد-بنعلي');
    expect(sanitizeFileNamePart('M. #1 50%')).toBe('M.-1-50');
    expect(sanitizeFileNamePart('Fatima Z.')).toBe('Fatima-Z');
  });

  it('remplace un nom vide ou entièrement interdit par « Patient »', () => {
    expect(pdfFileName('mental', '  ', at)).toContain('_Patient_');
    expect(pdfFileName('mental', '/:*?', at)).toContain('_Patient_');
  });

  it('limite la longueur du nom', () => {
    expect(sanitizeFileNamePart('x'.repeat(200))).toHaveLength(60);
  });
});
