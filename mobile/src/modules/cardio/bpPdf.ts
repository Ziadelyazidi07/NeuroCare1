import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { BP_ADVICE, PROTOCOL_SIZE, averageOf, formatAverage, protocolDay, slotKey, type BpLevel } from './bp';
import type { BpSeriesDto } from './bpApi';

const LEVEL_CLASS: Record<BpLevel, string> = {
  URGENCE_HYPERTENSIVE: 'ROUGE',
  HYPOTENSION: 'ORANGE',
  TENSION_ELEVEE: 'ORANGE',
  NORMALE: 'VERT',
};

/** Relevé d'automesure nominatif : tableau 3 jours matin / soir (M1-M3), moyenne, alertes et orientation. */
export function bpReportHtml(patient: string, series: BpSeriesDto, generatedAt: Date): string {
  const bySlot = new Map(series.mesures.map((m) => [slotKey(m), m]));
  const rows = ([1, 2, 3] as const)
    .flatMap((jour) =>
      (['MATIN', 'SOIR'] as const).map((moment) => {
        const cells = ([1, 2, 3] as const)
          .map((rang) => {
            const m = bySlot.get(slotKey({ jour, moment, rang }));
            return m ? `<td class="${LEVEL_CLASS[m.niveau]}">${m.tas}/${m.tad}<br />${m.pouls} bpm</td>` : '<td>—</td>';
          })
          .join('');
        return `<tr><td>Jour ${jour} (${protocolDay(series.dateDebut, jour - 1)})</td><td>${moment === 'MATIN' ? 'Matin' : 'Soir'}</td>${cells}</tr>`;
      }),
    )
    .join('');

  const avg = averageOf(series.mesures);
  const alerts = series.mesures.filter((m) => m.niveau !== 'NORMALE');
  const averageText = avg
    ? `Moyenne de ${avg.count} mesure${avg.count > 1 ? 's' : ''} sur ${PROTOCOL_SIZE} : <strong>${formatAverage(avg)}</strong>, pouls ${avg.pouls.toFixed(1).replace('.', ',')} bpm`
    : 'Aucune mesure saisie.';
  const orientation = !avg
    ? ''
    : avg.elevated
      ? 'Moyenne supérieure ou égale à 135/85 mmHg : montrez ce relevé à votre médecin.'
      : avg.complete
        ? 'Moyenne inférieure à 135/85 mmHg sur les 18 mesures.'
        : 'Protocole incomplet : la moyenne est provisoire.';

  const body = `
    <div class="box">Protocole d’automesure commencé le ${protocolDay(series.dateDebut, 0)} (3 jours consécutifs, 3 mesures le matin et 3 le soir)<br />
      ${averageText}</div>
    <h2>Orientation</h2>
    <div class="box">${escapeHtml(orientation)}</div>
    <h2>Relevé complet (TAS/TAD en mmHg, pouls)</h2>
    <table><tr><th>Jour</th><th>Moment</th><th>M1</th><th>M2</th><th>M3</th></tr>${rows}</table>
    <h2>Alertes</h2>
    ${
      alerts.length
        ? `<ul>${alerts
            .map(
              (m) =>
                `<li><span class="${LEVEL_CLASS[m.niveau]}">${formatDateTime(m.dateMesure)} — ${m.tas}/${m.tad} : ${escapeHtml(BP_ADVICE[m.niveau].title)}</span></li>`,
            )
            .join('')}</ul>`
        : '<p>Aucune alerte.</p>'
    }`;

  return pdfDocument({ title: 'Relevé d’automesure tensionnelle (HTA)', patient, generatedAt, body });
}
