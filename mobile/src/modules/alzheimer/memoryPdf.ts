import { escapeHtml, formatDateTime, pdfDocument } from '../pdf';
import { DOMAINS, DOMAIN_LABELS, QUESTIONS, VIGILANCE_TEXT, WORDS, personalisedTips } from './memory';
import type { MemoryAssessment } from './memoryStore';

export const SCREENING_NOTICE =
  'Questionnaire d’observation et exercice de mémoire non validés comme test diagnostique : outil de pré-dépistage et d’aide à la consultation médicale. Seul un médecin peut interpréter ces éléments et décider d’un bilan.';

const CLASS = { RASSURANT: 'VERT', SIGNES_A_SIGNALER: 'ORANGE' } as const;

function exerciseHtml(a: MemoryAssessment): string {
  const e = a.exercice;
  if (!e) return '<div class="box">Exercice de mémoire non réalisé lors de ce bilan.</div>';
  const missed = WORDS.map((w) => w.word).filter((w) => !e.rappelLibre.includes(w) && !e.reconnus.includes(w));
  return `<table>
    <tr><th>Mots à retenir</th><td>${WORDS.map((w) => escapeHtml(w.word)).join(', ')}</td></tr>
    <tr><th>Rappel libre</th><td><strong>${e.rappelLibre.length} / 4</strong>${e.rappelLibre.length ? ` (${e.rappelLibre.map(escapeHtml).join(', ')})` : ''}</td></tr>
    <tr><th>Reconnus parmi les images</th><td>${e.reconnus.length ? e.reconnus.map(escapeHtml).join(', ') : '—'}</td></tr>
    <tr><th>Ni retrouvés ni reconnus</th><td>${missed.length ? missed.map(escapeHtml).join(', ') : 'aucun'}</td></tr>
    <tr><th>Intrus choisis</th><td>${e.intrusChoisis.length ? e.intrusChoisis.map(escapeHtml).join(', ') : 'aucun'}</td></tr>
    <tr><th>Orientation (jour de la semaine)</th><td>${e.jourRepondu === e.jourDemande ? 'Correct' : `Répondu « ${escapeHtml(e.jourRepondu)} » (jour : ${escapeHtml(e.jourDemande)})`}</td></tr>
    <tr><th>Calcul simple (distraction)</th><td>${e.calculCorrect ? 'Correct' : 'Erreur'}</td></tr>
  </table>`;
}

function summary(a: MemoryAssessment): string {
  const signs = DOMAINS.reduce((sum, d) => sum + a.signes[d], 0);
  const recall = a.exercice ? `rappel ${a.exercice.rappelLibre.length}/4` : 'sans exercice';
  return `${signs}/8 signes · ${recall}`;
}

/** Bilan nominatif : 4 A par domaine, exercice de rappel, orientation, conseils et historique local. */
export function memoryReportHtml(patient: string, a: MemoryAssessment, history: readonly MemoryAssessment[], generatedAt: Date): string {
  const text = VIGILANCE_TEXT[a.indice];
  const domains = DOMAINS.map((d) => {
    const items = QUESTIONS.filter((q) => q.domain === d)
      .map((q) => `${escapeHtml(q.text)} <strong>${a.reponses[q.code] ? 'Oui' : 'Non'}</strong>`)
      .join('<br />');
    const n = a.signes[d];
    return `<tr><td><strong>${DOMAIN_LABELS[d].title}</strong><br />${DOMAIN_LABELS[d].area}</td>
      <td class="${n ? 'ORANGE' : 'VERT'}">${n} / 2</td><td>${items}</td></tr>`;
  }).join('');
  const reasons = a.raisons.length ? `<ul>${a.raisons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : '';
  const tips = `<ul>${personalisedTips(a.reponses).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
  const rows = history
    .map((h) => `<tr><td>${formatDateTime(h.date)}</td><td class="${CLASS[h.indice]}">${escapeHtml(VIGILANCE_TEXT[h.indice].title.replace('Indice de vigilance cognitive : ', ''))}</td><td>${escapeHtml(summary(h))}</td></tr>`)
    .join('');

  const body = `
    <div class="box">Bilan du ${formatDateTime(a.date)} (observations des dernières semaines)</div>
    <h2>Résultat et orientation</h2>
    <div class="box"><strong class="${CLASS[a.indice]}">${escapeHtml(text.title)}</strong><br />${escapeHtml(text.message)}${reasons}</div>
    <h2>Pré-dépistage des 4 A</h2>
    <table><tr><th>Domaine</th><th>Signes</th><th>Questions et réponses</th></tr>${domains}</table>
    <h2>Exercice de mémoire (4 mots)</h2>
    ${exerciseHtml(a)}
    <h2>Conseils pratiques</h2>
    ${tips}
    <h2>Historique enregistré sur le téléphone</h2>
    ${rows ? `<table><tr><th>Date</th><th>Indice</th><th>Détail</th></tr>${rows}</table>` : '<p>Aucun autre bilan.</p>'}
    <div class="box">${escapeHtml(SCREENING_NOTICE)}</div>`;

  return pdfDocument({ title: 'Bilan Mémoire & 4 A — pré-dépistage cognitif', patient, generatedAt, body });
}
