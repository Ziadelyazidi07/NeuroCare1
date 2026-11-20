/** PDF nominatifs des modules de pré-dépistage : HTML (français ou arabe) imprimé par expo-print puis partagé. */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Dictionary } from '../i18n';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** « 19/11/2026 08:05 » en heure locale (chiffres identiques en français et en arabe). */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Page complète : en-tête nominatif, contenu (HTML déjà échappé) et mention de non-diagnostic. En arabe, le
 * document est en `dir="rtl"` : tableaux, listes et paragraphes se lisent de droite à gauche.
 */
export function pdfDocument({ t, title, patient, generatedAt, body }: { t: Dictionary; title: string; patient: string; generatedAt: Date; body: string }): string {
  return `<!doctype html>
<html lang="${t.meta.lang}" dir="${t.meta.dir}"><head><meta charset="utf-8" />
<style>
  body { font-family: ${t.meta.dir === 'rtl' ? "'Noto Naskh Arabic', 'Geeza Pro', Tahoma, " : ''}Helvetica, Arial, sans-serif; color: #1C2B45; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; color: #112950; margin: 0 0 4px; }
  h2 { font-size: 16px; color: #112950; margin: 24px 0 8px; }
  .meta { color: #55657E; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #E6EEF8; padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #EBF2FF; color: #112950; }
  .VERT { color: #14653A; font-weight: bold; } .ORANGE { color: #8A4600; font-weight: bold; } .ROUGE { color: #C62828; font-weight: bold; }
  .box { border: 1px solid #E6EEF8; border-radius: 12px; padding: 12px; margin-top: 8px; background: #F5F8FC; }
  .notice { margin-top: 28px; padding: 12px; border: 1px solid #F1C66B; background: #FFF8E6; border-radius: 12px; }
  .ltr { direction: ltr; unicode-bidi: embed; }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(t.pdf.patient)} : <strong>${escapeHtml(patient)}</strong><br />${escapeHtml(t.pdf.generated(formatDateTime(generatedAt)))}</div>
  ${body}
  <div class="notice">${escapeHtml(t.shared.notADiagnosis)}</div>
</body></html>`;
}

/** Imprime le HTML en PDF puis ouvre le partage (enregistrer, envoyer au médecin…). */
export async function sharePdf(t: Dictionary, html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    throw new Error(t.shared.sharingUnavailable);
  }
}
