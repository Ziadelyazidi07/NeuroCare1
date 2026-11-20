import type { Dictionary } from '../../i18n';
import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { DOMAINS, QUESTIONS, WORDS, personalisedTips, reasonText } from './memory';
import type { MemoryAssessment } from './memoryStore';

const CLASS = { RASSURANT: 'VERT', SIGNES_A_SIGNALER: 'ORANGE' } as const;

function exerciseHtml(t: Dictionary, a: MemoryAssessment): string {
  const m = t.memory;
  const e = a.exercice;
  if (!e) return `<div class="box">${escapeHtml(m.pdf.noExercise)}</div>`;
  const list = (ids: readonly (keyof typeof m.things)[]) => (ids.length ? ids.map((id) => escapeHtml(m.things[id])).join(t.meta.listSeparator) : escapeHtml(m.pdf.none));
  const missed = WORDS.map((w) => w.id).filter((id) => !e.rappelLibre.includes(id) && !e.reconnus.includes(id));
  const dayName = (index: number) => m.weekdays[index] ?? '—';
  return `<table>
    <tr><th>${escapeHtml(m.pdf.wordsToLearn)}</th><td>${list(WORDS.map((w) => w.id))}</td></tr>
    <tr><th>${escapeHtml(m.pdf.freeRecall)}</th><td><strong>${e.rappelLibre.length} / 4</strong>${e.rappelLibre.length ? ` (${list(e.rappelLibre)})` : ''}</td></tr>
    <tr><th>${escapeHtml(m.pdf.recognised)}</th><td>${e.reconnus.length ? list(e.reconnus) : '—'}</td></tr>
    <tr><th>${escapeHtml(m.pdf.missed)}</th><td>${list(missed)}</td></tr>
    <tr><th>${escapeHtml(m.pdf.intruders)}</th><td>${list(e.intrusChoisis)}</td></tr>
    <tr><th>${escapeHtml(m.pdf.orientation)}</th><td>${escapeHtml(e.jourRepondu === e.jourDemande ? m.pdf.correct : m.pdf.wrongDay(dayName(e.jourRepondu), dayName(e.jourDemande)))}</td></tr>
    <tr><th>${escapeHtml(m.pdf.calculation)}</th><td>${escapeHtml(e.calculCorrect ? m.pdf.correct : m.pdf.wrong)}</td></tr>
  </table>`;
}

/** Bilan nominatif (français ou arabe) : 4 A par domaine, exercice de rappel, orientation, conseils et historique local. */
export function memoryReportHtml(t: Dictionary, patient: string, a: MemoryAssessment, history: readonly MemoryAssessment[], generatedAt: Date): string {
  const m = t.memory;
  const text = m.vigilance[a.indice];
  const domains = DOMAINS.map((d) => {
    const items = QUESTIONS.filter((q) => q.domain === d)
      .map((q) => `${escapeHtml(m.questions[q.code])} <strong>${escapeHtml(a.reponses[q.code] ? t.common.yes : t.common.no)}</strong>`)
      .join('<br />');
    const n = a.signes[d];
    return `<tr><td><strong>${escapeHtml(m.domains[d].title)}</strong><br />${escapeHtml(m.domains[d].area)}</td>
      <td class="${n ? 'ORANGE' : 'VERT'}">${n} / 2</td><td>${items}</td></tr>`;
  }).join('');
  const reasons = a.raisons.length ? `<ul>${a.raisons.map((r) => `<li>${escapeHtml(reasonText(t, r))}</li>`).join('')}</ul>` : '';
  const tips = `<ul>${personalisedTips(t, a.reponses).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`;
  const signs = (h: MemoryAssessment) => DOMAINS.reduce((sum, d) => sum + h.signes[d], 0);
  const rows = history
    .map(
      (h) =>
        `<tr><td>${formatDateTime(h.date)}</td><td class="${CLASS[h.indice]}">${escapeHtml(m.vigilance[h.indice].short)}</td><td>${escapeHtml(
          m.pdf.summary(signs(h), h.exercice ? h.exercice.rappelLibre.length : null),
        )}</td></tr>`,
    )
    .join('');
  const head = (cols: string[]) => cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('');

  const body = `
    <div class="box">${escapeHtml(m.pdf.session(formatDateTime(a.date)))}</div>
    <h2>${escapeHtml(m.pdf.resultTitle)}</h2>
    <div class="box"><strong class="${CLASS[a.indice]}">${escapeHtml(text.title)}</strong><br />${escapeHtml(text.message)}${reasons}</div>
    <h2>${escapeHtml(m.pdf.fourATitle)}</h2>
    <table><tr>${head(m.pdf.fourAColumns)}</tr>${domains}</table>
    <h2>${escapeHtml(m.pdf.exerciseTitle)}</h2>
    ${exerciseHtml(t, a)}
    <h2>${escapeHtml(m.pdf.tipsTitle)}</h2>
    ${tips}
    <h2>${escapeHtml(m.pdf.historyTitle)}</h2>
    ${rows ? `<table><tr>${head(m.pdf.historyColumns)}</tr>${rows}</table>` : `<p>${escapeHtml(m.pdf.noHistory)}</p>`}
    <div class="box">${escapeHtml(m.screeningNotice)}</div>`;

  return pdfDocument({ t, title: m.pdf.title, patient, generatedAt, body });
}
