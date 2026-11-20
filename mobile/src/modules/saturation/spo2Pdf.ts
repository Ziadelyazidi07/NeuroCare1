import type { Dictionary } from '../../i18n';
import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import type { Spo2Measurement } from './spo2Store';

/** Relevé SpO2 nominatif (français ou arabe) : profil respiratoire, historique et alertes. */
export function spo2ReportHtml(t: Dictionary, patient: string, chronic: boolean, measures: Spo2Measurement[], generatedAt: Date): string {
  const s = t.spo2;
  const alerts = measures.filter((m) => m.niveau !== 'VERT');
  const rows = measures
    .map(
      (m) => `<tr><td class="ltr">${formatDateTime(m.dateMesure)}</td><td>${m.spo2} %</td><td>${m.pouls} ${escapeHtml(s.bpm)}</td>
        <td>${escapeHtml(s.profileLabel(m.maladieRespiratoireChronique))}</td>
        <td class="${m.niveau}">${escapeHtml(s.pdf.level[m.niveau])}</td></tr>`,
    )
    .join('');
  const alertItems = alerts
    .map((m) => {
      const advice = s.advice(m.niveau, m.maladieRespiratoireChronique);
      return `<li><span class="${m.niveau}">${formatDateTime(m.dateMesure)} — ${m.spo2} % : ${escapeHtml(advice.title)}</span><br />${escapeHtml(advice.message)}</li>`;
    })
    .join('');
  const head = s.pdf.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  const body = `
    <div class="box">${escapeHtml(s.pdf.profile)} : <strong>${escapeHtml(s.profileLabel(chronic))}</strong><br />
      ${escapeHtml(s.pdf.counts(measures.length, alerts.length))}</div>
    <h2>${escapeHtml(s.pdf.historyTitle)}</h2>
    ${measures.length ? `<table><tr>${head}</tr>${rows}</table>` : `<p>${escapeHtml(s.pdf.none)}</p>`}
    <h2>${escapeHtml(s.pdf.alertsTitle)}</h2>
    ${alerts.length ? `<ul>${alertItems}</ul>` : `<p>${escapeHtml(s.pdf.noAlerts)}</p>`}`;

  return pdfDocument({ t, title: s.pdf.title, patient, generatedAt, body });
}
