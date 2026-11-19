import { describe, expect, it, jest } from '@jest/globals';

import { classifySpo2, parseMeasurement, spo2Advice } from '../spo2';
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
    expect(spo2Advice('ROUGE', false).message).toContain('15 ou 141');
    expect(spo2Advice('ORANGE', false).message).toMatch(/10 minutes.*médecin/);
    expect(spo2Advice('ORANGE', true).title).toContain('88-92');
  });

  it('refuse les saisies impossibles', () => {
    expect(parseMeasurement('97', '72')).toEqual({ spo2: 97, pouls: 72 });
    expect(typeof parseMeasurement('101', '72')).toBe('string');
    expect(typeof parseMeasurement('9a', '72')).toBe('string');
    expect(typeof parseMeasurement('97', '20')).toBe('string');
  });
});

describe('relevé PDF', () => {
  it('est nominatif, liste les mesures et les alertes, et échappe le HTML', () => {
    const html = spo2ReportHtml(
      'Hajj <Ahmed>',
      true,
      [
        { id: '1', dateMesure: '2026-11-19T08:00:00Z', spo2: 84, pouls: 101, maladieRespiratoireChronique: true, niveau: 'ROUGE' },
        { id: '2', dateMesure: '2026-11-18T08:00:00Z', spo2: 90, pouls: 80, maladieRespiratoireChronique: true, niveau: 'VERT' },
      ],
      new Date('2026-11-19T09:00:00Z'),
    );
    expect(html).toContain('Hajj &lt;Ahmed&gt;');
    expect(html).toContain('BPCO');
    expect(html).toContain('84 %');
    expect(html).toContain('Mesures : 2 · Alertes : 1');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
  });
});
