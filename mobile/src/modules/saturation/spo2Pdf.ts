import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { profileLabel, spo2Advice, type Spo2Level } from './spo2';
import type { Spo2Measurement } from './spo2Store';

const LEVEL_LABEL: Record<Spo2Level, string> = { VERT: 'Vert', ORANGE: 'Alerte orange', ROUGE: 'Alerte rouge' };

/** Relevé SpO2 nominatif : profil respiratoire, historique et alertes. */
export function spo2ReportHtml(patient: string, chronic: boolean, measures: Spo2Measurement[], generatedAt: Date): string {
  const alerts = measures.filter((m) => m.niveau !== 'VERT');
  const rows = measures
    .map(
      (m) => `<tr><td>${formatDateTime(m.dateMesure)}</td><td>${m.spo2} %</td><td>${m.pouls} bpm</td>
        <td>${escapeHtml(profileLabel(m.maladieRespiratoireChronique))}</td>
        <td class="${m.niveau}">${LEVEL_LABEL[m.niveau]}</td></tr>`,
    )
    .join('');
  const alertItems = alerts
    .map((m) => {
      const advice = spo2Advice(m.niveau, m.maladieRespiratoireChronique);
      return `<li><span class="${m.niveau}">${formatDateTime(m.dateMesure)} — ${m.spo2} % : ${escapeHtml(advice.title)}</span><br />${escapeHtml(advice.message)}</li>`;
    })
    .join('');

  const body = `
    <div class="box">Profil respiratoire actuel : <strong>${escapeHtml(profileLabel(chronic))}</strong><br />
      Mesures : ${measures.length} · Alertes : ${alerts.length}</div>
    <h2>Historique des mesures (au repos)</h2>
    ${measures.length ? `<table><tr><th>Date / heure</th><th>SpO2</th><th>Pouls</th><th>Profil</th><th>Niveau</th></tr>${rows}</table>` : '<p>Aucune mesure enregistrée.</p>'}
    <h2>Alertes et orientation</h2>
    ${alerts.length ? `<ul>${alertItems}</ul>` : '<p>Aucune alerte sur la période.</p>'}`;

  return pdfDocument({ title: 'Relevé de saturation en oxygène (SpO2)', patient, generatedAt, body });
}
