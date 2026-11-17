/** Dates locales du téléphone (le senior et son aidant vivent dans le même fuseau). */

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** AAAA-MM-JJ en heure locale. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Lundi de la semaine de `date` (semaine ISO, lundi = premier jour). */
export function mondayOf(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay(); // 0 = dimanche
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1));
  return copy;
}

/** « 08:05 » pour un instant ISO. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** « 17/11 » pour une date ou un instant ISO. */
export function formatDay(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Secondes restantes avant `iso`, jamais négatif. */
export function secondsUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 1000));
}
