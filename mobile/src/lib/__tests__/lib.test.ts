import { describe, expect, it } from '@jest/globals';

import { addDays, formatDay, mondayOf, secondsUntil, toIsoDate } from '../dates';
import { currentDose, doseToAnnounce, isConfirmable, isDue, msUntilNextDue, pillColour, statusLabel, type DoseLike } from '../doses';
import { acknowledge, enqueue, withLocalConfirmations, type PendingConfirmation } from '../offlineQueue';
import { ApiError, errorMessage, networkError, toApiError } from '../problem';
import { ar } from '../../i18n/ar';
import { fr } from '../../i18n/fr';
import { cleanApiBase, seniorTopic, wsUrlFromApi } from '../urls';
import { isE164, isSixDigitCode, normalizePhone, parseHHMM, registrationError } from '../validation';

const NOW = new Date('2026-11-17T10:00:00Z');
const at = (minutesFromNow: number) => new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString();
const dose = (id: string, minutes: number, statut: DoseLike['statut'] = 'EN_ATTENTE'): DoseLike => ({
  id,
  datePrevue: at(minutes),
  statut,
});

describe('pastilles et libellés (EF-DA-01, §13.3)', () => {
  it('associe vert, orange et gris aux statuts', () => {
    expect(pillColour('CONFIRME')).toBe('VERT');
    expect(pillColour('SANS_REPONSE')).toBe('ORANGE');
    expect(pillColour('EN_ATTENTE')).toBe('GRIS');
    expect(pillColour('DESACTIVE')).toBe('GRIS');
  });

  it("ne présente jamais l'absence de réponse comme un oubli", () => {
    const labels = (['EN_ATTENTE', 'CONFIRME', 'SANS_REPONSE', 'DESACTIVE'] as const).map((s) => statusLabel(s, fr));
    expect(labels.join(' ').toLowerCase()).not.toMatch(/oubli|non pris|non-prise/);
    expect(statusLabel('SANS_REPONSE', fr)).toBe('Sans réponse');
    expect(statusLabel('SANS_REPONSE', ar)).toBe('بدون رد');
  });
});

describe('prise mise en avant sur l’écran du senior', () => {
  it('privilégie la prise confirmable la plus ancienne', () => {
    const doses = [dose('b', 120), dose('a', -10), dose('c', 5)];
    expect(currentDose(doses, NOW)?.id).toBe('a');
  });

  it('sinon affiche la prochaine prise à venir', () => {
    expect(currentDose([dose('later', 240), dose('soon', 90)], NOW)?.id).toBe('soon');
    expect(currentDose([dose('x', -60, 'CONFIRME')], NOW)).toBeNull();
  });

  it('autorise la confirmation 30 min avant l’heure, jamais une prise clôturée', () => {
    expect(isConfirmable(dose('a', 29), NOW)).toBe(true);
    expect(isConfirmable(dose('a', 31), NOW)).toBe(false);
    expect(isConfirmable(dose('a', -5, 'SANS_REPONSE'), NOW)).toBe(false);
    expect(isDue(dose('a', 0), NOW)).toBe(true);
    expect(isDue(dose('a', 1), NOW)).toBe(false);
  });
});

describe('déclenchement du rappel', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  const pending = (id: string, datePrevue: string): DoseLike => ({ id, datePrevue, statut: 'EN_ATTENTE' });
  const doses = [
    pending('ancienne', '2026-11-19T09:50:00Z'),
    pending('recente', '2026-11-19T10:00:00Z'),
    pending('suivante', '2026-11-19T10:01:00Z'),
  ];

  it('annonce la prise due la plus récente, une seule fois', () => {
    expect(doseToAnnounce(doses, now, new Set())?.id).toBe('recente');
    expect(doseToAnnounce(doses, now, new Set(['recente']))?.id).toBe('ancienne');
    expect(doseToAnnounce(doses, now, new Set(['recente', 'ancienne']))).toBeNull();
  });

  it('calcule le délai exact avant la prochaine prise', () => {
    expect(msUntilNextDue(doses, now)).toBe(60_000);
    expect(msUntilNextDue([{ ...doses[2]!, statut: 'CONFIRME' }], now)).toBeNull();
  });
});

describe('file hors ligne (CA-10)', () => {
  const item = (doseId: string, key: string): PendingConfirmation => ({
    doseId,
    clientRequestId: key,
    horodatageClient: NOW.toISOString(),
  });

  it('ne duplique pas une prise déjà en file : la première confirmation compte', () => {
    const queue = enqueue(enqueue([], item('d1', 'k1')), item('d1', 'k2'));
    expect(queue).toEqual([item('d1', 'k1')]);
  });

  it('retire les éléments traités par le serveur, quel que soit le résultat', () => {
    const queue = [item('d1', 'k1'), item('d2', 'k2'), item('d3', 'k3')];
    const left = acknowledge(queue, [
      { doseId: 'd1', clientRequestId: 'k1', resultat: 'APPLIQUEE' },
      { doseId: 'd2', clientRequestId: 'k2', resultat: 'REFUSEE' },
    ]);
    expect(left).toEqual([item('d3', 'k3')]);
  });

  it('affiche localement comme confirmées les prises en file', () => {
    const shown = withLocalConfirmations([dose('d1', -5), dose('d2', 30), dose('d3', -90, 'SANS_REPONSE')], [item('d1', 'k1'), item('d3', 'k3')]);
    expect(shown.map((d) => d.statut)).toEqual(['CONFIRME', 'EN_ATTENTE', 'SANS_REPONSE']);
  });
});

describe('dates locales', () => {
  it('trouve le lundi de la semaine', () => {
    expect(toIsoDate(mondayOf(new Date(2026, 10, 19)))).toBe('2026-11-16'); // jeudi
    expect(toIsoDate(mondayOf(new Date(2026, 10, 22)))).toBe('2026-11-16'); // dimanche
    expect(toIsoDate(mondayOf(new Date(2026, 10, 16)))).toBe('2026-11-16'); // lundi
    expect(toIsoDate(addDays(new Date(2026, 10, 30), 1))).toBe('2026-12-01');
  });

  it('formate un jour et un compte à rebours', () => {
    expect(formatDay('2026-11-07')).toBe('07/11');
    expect(secondsUntil(at(2), NOW)).toBe(120);
    expect(secondsUntil(at(-2), NOW)).toBe(0);
  });
});

describe('inscription', () => {
  const valid = { nomComplet: 'Salma B.', telephone: '+212600000009', motDePasse: 'motdepasse', confirmation: 'motdepasse' };

  it('accepte un formulaire complet', () => {
    expect(registrationError(valid)).toBeNull();
  });

  it('refuse un formulaire incomplet ou incohérent', () => {
    expect(registrationError({ ...valid, nomComplet: ' ' })).toBe('NOM');
    expect(registrationError({ ...valid, telephone: '0600' })).toBe('TELEPHONE');
    expect(registrationError({ ...valid, motDePasse: 'court', confirmation: 'court' })).toBe('MOT_DE_PASSE');
    expect(registrationError({ ...valid, confirmation: 'autre' })).toBe('CONFIRMATION');
    expect(fr.registration.MOT_DE_PASSE).toContain('8 et 72');
  });
});

describe('saisies', () => {
  it('normalise les numéros marocains', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe('+212612345678');
    expect(normalizePhone('00212612345678')).toBe('+212612345678');
    expect(isE164(normalizePhone('+212 6 12 34 56 78'))).toBe(true);
    expect(isE164('0612')).toBe(false);
  });

  it('valide les horaires et le code d’appairage', () => {
    expect(parseHHMM('8:05')).toBe('08:05');
    expect(parseHHMM('20:00')).toBe('20:00');
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('8h')).toBeNull();
    expect(isSixDigitCode('123456')).toBe(true);
    expect(isSixDigitCode('12345a')).toBe(false);
  });
});

describe('erreurs RFC 7807', () => {
  it('reprend le code métier et le détail', () => {
    const error = toApiError(403, { code: 'CONSENT_REQUIRED', detail: "Le consentement VOIX n'est pas accordé." });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.isConsentRequired).toBe(true);
    expect(errorMessage(error, fr)).toBe("Le consentement VOIX n'est pas accordé.");
    expect(errorMessage(networkError(), ar)).toBe(ar.errors.network);
    expect(errorMessage(toApiError(502, null), ar)).toBe('خطأ 502');
  });

  it('liste les erreurs de champ', () => {
    const error = toApiError(400, { code: 'VALIDATION_ERROR', errors: [{ field: 'telephone', message: 'doit être au format E.164' }] });
    expect(error.message).toBe('telephone : doit être au format E.164');
  });

  it('gère un corps absent', () => {
    expect(toApiError(502, null).code).toBe('HTTP_502');
  });
});

describe('adresses du backend', () => {
  it('dérive l’URL STOMP de l’URL de l’API', () => {
    expect(wsUrlFromApi('http://localhost:8088/api/v1')).toBe('ws://localhost:8088/ws');
    expect(wsUrlFromApi('https://api.neurocare.ma/api/v1/')).toBe('wss://api.neurocare.ma/ws');
    expect(cleanApiBase(' http://10.0.2.2:8088/api/v1// ')).toBe('http://10.0.2.2:8088/api/v1');
    expect(seniorTopic('abc')).toBe('/topic/seniors/abc/events');
  });
});
