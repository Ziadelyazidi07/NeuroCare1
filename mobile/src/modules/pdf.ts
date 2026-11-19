/** PDF nominatifs des modules de pré-dépistage : HTML imprimé par expo-print puis partagé. */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const NOT_A_DIAGNOSIS =
  'Outil de pré-dépistage, de suivi et d’orientation : ce document ne constitue pas un diagnostic médical officiel et ne remplace pas un médecin.';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** « 19/11/2026 08:05 » en heure locale. */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Page complète : en-tête nominatif, contenu (HTML déjà échappé) et mention de non-diagnostic. */
export function pdfDocument({ title, patient, generatedAt, body }: { title: string; patient: string; generatedAt: Date; body: string }): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #1B1F24; margin: 32px; font-size: 13px; }
  h1 { font-size: 22px; color: #0B57D0; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .meta { color: #5F6368; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #DADCE0; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #F6F8FB; }
  .VERT { color: #1E7B34; font-weight: bold; } .ORANGE { color: #B05A00; font-weight: bold; } .ROUGE { color: #B3261E; font-weight: bold; }
  .box { border: 1px solid #DADCE0; border-radius: 8px; padding: 12px; margin-top: 8px; }
  .notice { margin-top: 28px; padding: 12px; border: 1px solid #CC9900; background: #FFF8E1; border-radius: 8px; }
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Patient : <strong>${escapeHtml(patient)}</strong><br />Document généré le ${formatDateTime(generatedAt)} par NeuroCare</div>
  ${body}
  <div class="notice">${escapeHtml(NOT_A_DIAGNOSIS)}</div>
</body></html>`;
}

/** Imprime le HTML en PDF puis ouvre le partage (enregistrer, envoyer au médecin…). */
export async function sharePdf(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    throw new Error('Le partage de fichiers est indisponible sur ce téléphone.');
  }
}
