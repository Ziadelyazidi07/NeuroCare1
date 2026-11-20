/** PDF nominatifs des modules de pré-dépistage : HTML (français ou arabe) imprimé par expo-print puis partagé. */
import { cacheDirectory, deleteAsync, moveAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Dictionary } from '../i18n';
import { pdfFileName, type PdfModule } from '../lib/pdfFileName';
import { NEUROCARE_LOGO_DATA_URI } from './pdfLogo';

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
  .brand { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 2px solid #E6EEF8; }
  .brand img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; }
  .brand span { font-size: 20px; font-weight: bold; color: #112950; }
</style></head>
<body>
  <div class="brand"><img src="${NEUROCARE_LOGO_DATA_URI}" alt="NeuroCare" /><span>NeuroCare</span></div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(t.pdf.patient)} : <strong>${escapeHtml(patient)}</strong><br />${escapeHtml(t.pdf.generated(formatDateTime(generatedAt)))}</div>
  ${body}
  <div class="notice">${escapeHtml(t.shared.notADiagnosis)}</div>
</body></html>`;
}

/**
 * Renomme un PDF généré (`moveAsync`) en `fileName`, dans le cache de l'application, avant son partage.
 * Un fichier homonyme (même minute) est remplacé. Si le renommage échoue, le fichier d'origine est renvoyé.
 */
export async function renamePdf(uri: string, fileName: string): Promise<string> {
  const directory = cacheDirectory ?? uri.slice(0, uri.lastIndexOf('/') + 1);
  const to = directory + fileName;
  if (to === uri) return uri;
  try {
    await deleteAsync(to, { idempotent: true });
    await moveAsync({ from: uri, to });
    return to;
  } catch {
    return uri;
  }
}

export interface PdfShare {
  /** Titre de la feuille de partage. */
  dialogTitle: string;
  module: PdfModule;
  /** Nom affiché du patient (le nom par défaut de la langue devient « Patient » dans le nom du fichier). */
  patient: string;
  /** Date de génération, la même que celle imprimée dans le document. */
  generatedAt: Date;
}

/**
 * Imprime le HTML en PDF, le renomme `NeuroCare_<Module>_<Patient>_<YYYY-MM-DD>_<HHhMM>.pdf` puis ouvre le
 * partage (enregistrer, envoyer au médecin…). Renvoie le nom du fichier.
 */
export async function sharePdf(t: Dictionary, html: string, { dialogTitle, module, patient, generatedAt }: PdfShare): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html });
  const fileName = pdfFileName(module, patient === t.shared.defaultPatient ? '' : patient, generatedAt);
  const named = await renamePdf(uri, fileName);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(named, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    throw new Error(t.shared.sharingUnavailable);
  }
  return fileName;
}
