import { describe, expect, it, jest } from '@jest/globals';

import { PROTOCOL_SLOTS, averageOf, classifyBp, nextEmptySlot, parseBp } from '../bp';
import type { BpSeries } from '../bpStore';
import { bpReportHtml } from '../bpPdf';

jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

describe('alertes tensionnelles', () => {
  it.each([
    [180, 90, 'URGENCE_HYPERTENSIVE'],
    [150, 110, 'URGENCE_HYPERTENSIVE'],
    [179, 109, 'TENSION_ELEVEE'],
    [135, 70, 'TENSION_ELEVEE'],
    [120, 85, 'TENSION_ELEVEE'],
    [134, 84, 'NORMALE'],
    [100, 60, 'NORMALE'],
    [99, 60, 'HYPOTENSION'],
  ] as const)('%i/%i -> %s', (tas, tad, level) => {
    expect(classifyBp(tas, tad)).toBe(level);
  });

  it('refuse les saisies impossibles', () => {
    expect(parseBp('128', '78', '70')).toEqual({ tas: 128, tad: 78, pouls: 70 });
    expect(typeof parseBp('80', '90', '70')).toBe('string');
    expect(typeof parseBp('300', '90', '70')).toBe('string');
    expect(typeof parseBp('120', '80', '10')).toBe('string');
  });
});

describe('protocole sur 3 jours', () => {
  it('compte 18 créneaux et propose le premier vide', () => {
    expect(PROTOCOL_SLOTS).toHaveLength(18);
    expect(nextEmptySlot([])).toEqual({ jour: 1, moment: 'MATIN', rang: 1 });
    expect(nextEmptySlot([{ jour: 1, moment: 'MATIN', rang: 1 }])).toEqual({ jour: 1, moment: 'MATIN', rang: 2 });
    expect(nextEmptySlot(PROTOCOL_SLOTS)).toBeNull();
  });

  it('alerte quand la moyenne des 18 mesures atteint 135/85', () => {
    const normal = averageOf(PROTOCOL_SLOTS.map((_, i) => ({ tas: i % 2 ? 138 : 130, tad: 80, pouls: 70 })));
    expect(normal).toMatchObject({ tas: 134, complete: true, elevated: false });
    expect(averageOf(PROTOCOL_SLOTS.map(() => ({ tas: 128, tad: 86, pouls: 70 })))?.elevated).toBe(true);
    expect(averageOf([])).toBeNull();
  });
});

describe('relevé PDF', () => {
  it('contient le tableau 3 jours matin / soir, la moyenne, les alertes et une orientation', () => {
    const series: BpSeries = {
      id: 's1',
      dateDebut: '2026-11-17',
      creeLe: '2026-11-17T06:00:00Z',
      mesures: PROTOCOL_SLOTS.map((s, i) => ({
        id: `m${i}`,
        dateMesure: '2026-11-17T06:00:00Z',
        tas: i === 0 ? 185 : 140,
        tad: 80,
        pouls: 70,
        niveau: i === 0 ? 'URGENCE_HYPERTENSIVE' : 'TENSION_ELEVEE',
        ...s,
      })),
    };
    const html = bpReportHtml('Hajj Ahmed', series, new Date('2026-11-20T09:00:00Z'));
    expect(html).toContain('Hajj Ahmed');
    expect(html.match(/<tr><td>Jour \d/g)).toHaveLength(6);
    expect(html).toContain('Jour 3 (19/11)');
    expect(html).toContain('142,5 / 80,0 mmHg');
    expect(html).toContain('montrez ce relevé à votre médecin');
    expect(html).toContain('185/80');
    expect(html).toContain('ne constitue pas un diagnostic médical officiel');
  });
});
