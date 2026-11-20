/**
 * Rapport hebdomadaire du mode démo, généré sur le téléphone (le vrai rapport est produit par le serveur).
 * Même contenu descriptif : prises de la semaine, résumé, exercices, observations, mentions éthiques.
 */
import type { Dictionary } from '../i18n';
import { formatDay, formatTime } from '../lib/dates';
import { statusLabel } from '../lib/doses';
import { escapeHtml, pdfDocument, sharePdf } from '../modules/pdf';
import { addDays, localDay } from './demoData';
import { demoWeek } from './demoBackend';

const CLASS = { CONFIRME: 'VERT', SANS_REPONSE: 'ORANGE', EN_ATTENTE: '', DESACTIVE: '' } as const;

export async function demoReportHtml(t: Dictionary, seniorId: string, weekStart: Date, observations: string, generatedAt: Date): Promise<{ html: string; patient: string }> {
  const r = t.demo.report;
  const { senior, doses, exercises } = await demoWeek(seniorId, weekStart);
  const count = (statut: string) => doses.filter((d) => d.statut === statut).length;
  const confirmed = count('CONFIRME');
  const noAnswer = count('SANS_REPONSE');
  const rate = confirmed + noAnswer ? `${Math.round((100 * confirmed) / (confirmed + noAnswer))} %` : '—';
  const rows = doses
    .map(
      (d) => `<tr><td>${escapeHtml(formatDay(localDay(new Date(d.datePrevue))))}</td><td>${escapeHtml(d.nomMedicament ?? '')}</td>
      <td>${formatTime(d.datePrevue)}</td><td class="${CLASS[d.statut]}">${escapeHtml(statusLabel(d.statut, t))}</td>
      <td>${d.horodatageAction ? formatTime(d.horodatageAction) : '—'}</td></tr>`,
    )
    .join('');
  const head = r.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const ex = exercises.length
    ? `<ul>${exercises.map((e) => `<li>${escapeHtml(r.exercise(formatDay(localDay(new Date(e.dateExercice))), e.corrects, e.motsPresentes))}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(r.noExercise)}</p>`;
  const body = `
    <div class="box">${escapeHtml(r.period(formatDay(localDay(weekStart)), formatDay(localDay(addDays(weekStart, 6)))))}<br />
      <strong>${escapeHtml(r.summary(confirmed, noAnswer, count('EN_ATTENTE')))}</strong><br />${escapeHtml(r.rate(rate))}</div>
    <h2>${escapeHtml(r.dosesTitle)}</h2>
    <table><tr>${head}</tr>${rows}</table>
    <h2>${escapeHtml(r.exercisesTitle)}</h2>
    ${ex}
    ${observations.trim() ? `<h2>${escapeHtml(r.observations)}</h2><p>${escapeHtml(observations.trim())}</p>` : ''}
    <div class="box">${escapeHtml(t.report.notice)}<br />${escapeHtml(r.fictive)}</div>`;
  return { html: pdfDocument({ t, title: r.title, patient: senior.nomComplet, generatedAt, body }), patient: senior.nomComplet };
}

/** Génère le rapport de démo, le nomme `NeuroCare_Rappels-Suivi_…pdf` et ouvre le partage. */
export async function shareDemoReport(t: Dictionary, seniorId: string, weekStart: Date, observations: string): Promise<string> {
  const now = new Date();
  const { html, patient } = await demoReportHtml(t, seniorId, weekStart, observations, now);
  return sharePdf(t, html, { dialogTitle: t.report.dialog, module: 'observance', patient, generatedAt: now });
}
