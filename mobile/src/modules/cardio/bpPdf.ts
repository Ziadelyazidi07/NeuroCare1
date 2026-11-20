import type { Dictionary } from '../../i18n';
import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { PROTOCOL_SIZE, averageOf, decimal, formatAverage, protocolDay, slotKey, type BpLevel } from './bp';
import type { BpSeries } from './bpStore';

const LEVEL_CLASS: Record<BpLevel, string> = {
  URGENCE_HYPERTENSIVE: 'ROUGE',
  HYPOTENSION: 'ORANGE',
  TENSION_ELEVEE: 'ORANGE',
  NORMALE: 'VERT',
};

/** Relevé d'automesure nominatif (français ou arabe) : tableau 3 jours matin / soir, moyenne, alertes et orientation. */
export function bpReportHtml(t: Dictionary, patient: string, series: BpSeries, generatedAt: Date): string {
  const b = t.bp;
  const bySlot = new Map(series.mesures.map((m) => [slotKey(m), m]));
  const rows = ([1, 2, 3] as const)
    .flatMap((jour) =>
      (['MATIN', 'SOIR'] as const).map((moment) => {
        const cells = ([1, 2, 3] as const)
          .map((rang) => {
            const m = bySlot.get(slotKey({ jour, moment, rang }));
            return m ? `<td class="${LEVEL_CLASS[m.niveau]}">${m.tas}/${m.tad}<br />${m.pouls} ${escapeHtml(b.bpm)}</td>` : '<td>—</td>';
          })
          .join('');
        return `<tr><td>${escapeHtml(b.pdf.day(jour, protocolDay(series.dateDebut, jour - 1)))}</td><td>${escapeHtml(b.moment[moment])}</td>${cells}</tr>`;
      }),
    )
    .join('');

  const avg = averageOf(series.mesures);
  const alerts = series.mesures.filter((m) => m.niveau !== 'NORMALE');
  const averageText = avg
    ? `${escapeHtml(b.pdf.average(avg.count, PROTOCOL_SIZE))} : <strong>${escapeHtml(formatAverage(avg, b.mmHg))}</strong>, ${escapeHtml(b.pdf.pulse(decimal(avg.pouls)))}`
    : escapeHtml(b.pdf.noMeasure);
  const orientation = !avg ? '' : avg.elevated ? b.pdf.elevated : avg.complete ? b.pdf.complete : b.pdf.partial;
  const head = b.pdf.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  const body = `
    <div class="box">${escapeHtml(b.pdf.started(protocolDay(series.dateDebut, 0)))}<br />
      ${averageText}</div>
    <h2>${escapeHtml(b.pdf.orientationTitle)}</h2>
    <div class="box">${escapeHtml(orientation)}</div>
    <h2>${escapeHtml(b.pdf.tableTitle)}</h2>
    <table><tr>${head}</tr>${rows}</table>
    <h2>${escapeHtml(b.pdf.alertsTitle)}</h2>
    ${
      alerts.length
        ? `<ul>${alerts
            .map(
              (m) =>
                `<li><span class="${LEVEL_CLASS[m.niveau]}">${formatDateTime(m.dateMesure)} — ${m.tas}/${m.tad} : ${escapeHtml(b.advice[m.niveau].title)}</span></li>`,
            )
            .join('')}</ul>`
        : `<p>${escapeHtml(b.pdf.noAlerts)}</p>`
    }`;

  return pdfDocument({ t, title: b.pdf.title, patient, generatedAt, body });
}
