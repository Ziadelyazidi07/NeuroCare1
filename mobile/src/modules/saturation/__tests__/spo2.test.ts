import { describe, expect, it, jest } from '@jest/globals';

import { ar } from '../../../i18n/ar';
import { fr } from '../../../i18n/fr';
import { classifySpo2, parseMeasurement } from '../spo2';
import { spo2ReportHtml } from '../spo2Pdf';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

describe('alertes SpO2', () => {
  it.each([
    [100, 'VERT'], [95, 'VERT'], [94, 'ORANGE'], [90, 'ORANGE'], [89, 'ROUGE'],
  ] as const)('profil standard : %i %% -> %s', (spo2, level) => {
    expect(classifySpo2(spo2, false)).toBe(level);
  });

  it.each([
    [96, 'ORANGE'], [93, 'ORANGE'], [92, 'VERT'], [88, 'VERT'], [87, 'ORANGE'], [85, 'ORANGE'], [84, 'ROUGE'],
  ] as const)('profil BPCO : %i %% -> %s', (spo2, level) => {
    expect(classifySpo2(spo2, true)).toBe(level);
  });

  it('oriente vers les urgences en alerte rouge et vers un médecin en orange', () => {
    expect(fr.spo2.advice('ROUGE', false).message).toContain('15 ou 141');
    expect(fr.spo2.advice('ORANGE', false).message).toMatch(/10 minutes.*médecin/);
    expect(fr.spo2.advice('ORANGE', true).title).toContain('88-92');
  });

  it('refuse les saisies impossibles', () => {
    expect(parseMeasurement('97', '72')).toEqual({ spo2: 97, pouls: 72 });
    expect(parseMeasurement('101', '72')).toBe('SPO2');
    expect(parseMeasurement('9a', '72')).toBe('SPO2');
    expect(parseMeasurement('97', '20')).toBe('PULSE');
  });
});

describe('relevé PDF', () => {
  it('est nominatif, liste les mesures et les alertes, et échappe le HTML', () => {
    const measures = [
        { id: '1', dateMesure: '2026-11-19T08:00:00Z', spo2: 84, pouls: 101, maladieRespiratoireChronique: true, niveau: 'ROUGE' },
        { id: '2', dateMesure: '2026-11-18T08:00:00Z', spo2: 90, pouls: 80, maladieRespiratoireChronique: true, niveau: 'VERT' },
    ] as const;
    const html = spo2ReportHtml(fr, 'Hajj <Ahmed>', true, [...measures], new Date('2026-11-19T09:00:00Z'));
    expect(html).toContain('Hajj &lt;Ahmed&gt;');
    expect(html).toContain('BPCO');
    expect(html).toContain('84 %');
    expect(html).toContain('Mesures : 2 · Alertes : 1');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
    expect(html).toContain('dir="ltr"');
  });

  it('s’édite en arabe, de droite à gauche', () => {
    const html = spo2ReportHtml(ar, 'المريض', false, [], new Date('2026-11-19T09:00:00Z'));
    expect(html).toContain('<html lang="ar" dir="rtl">');
    expect(html).toContain('كشف تشبّع الدم بالأكسجين');
    expect(html).toContain('ليست تشخيصًا طبيًا رسميًا');
  });
});
