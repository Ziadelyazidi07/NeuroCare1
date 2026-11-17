/** Règles d'affichage des prises (cahier §3.7 EF-DA-01, §13.3). */

export type DoseStatus = 'EN_ATTENTE' | 'CONFIRME' | 'SANS_REPONSE' | 'DESACTIVE';
export type PillColour = 'VERT' | 'ORANGE' | 'GRIS';

export interface DoseLike {
  id: string;
  datePrevue: string;
  statut: DoseStatus;
}

/** Pastille : verte (confirmé), orange (sans réponse), grise (en attente ou désactivé). */
export function pillColour(status: DoseStatus): PillColour {
  switch (status) {
    case 'CONFIRME':
      return 'VERT';
    case 'SANS_REPONSE':
      return 'ORANGE';
    default:
      return 'GRIS';
  }
}

/**
 * Libellés affichés. « Sans réponse » n'est jamais présenté comme un oubli ou une non-prise (§13.3),
 * et « Confirmé » ne prouve pas la prise du médicament.
 */
export function statusLabel(status: DoseStatus): string {
  switch (status) {
    case 'CONFIRME':
      return 'Confirmé';
    case 'SANS_REPONSE':
      return 'Sans réponse';
    case 'DESACTIVE':
      return 'Désactivé';
    default:
      return 'En attente';
  }
}

/** Une prise peut être confirmée dès 30 min avant l'heure prévue, tant qu'elle est en attente. */
export const CONFIRM_WINDOW_BEFORE_MS = 30 * 60 * 1000;

export function isConfirmable(dose: DoseLike, now: Date = new Date()): boolean {
  return dose.statut === 'EN_ATTENTE' && new Date(dose.datePrevue).getTime() - now.getTime() <= CONFIRM_WINDOW_BEFORE_MS;
}

/**
 * Prise mise en avant sur l'écran du senior : la plus ancienne confirmable, sinon la prochaine à venir.
 */
export function currentDose<T extends DoseLike>(doses: T[], now: Date = new Date()): T | null {
  const sorted = [...doses].sort((a, b) => a.datePrevue.localeCompare(b.datePrevue));
  const confirmable = sorted.find((d) => isConfirmable(d, now));
  if (confirmable) return confirmable;
  return sorted.find((d) => d.statut === 'EN_ATTENTE' && new Date(d.datePrevue) > now) ?? null;
}

/** La prise est due (heure atteinte) : l'audio de rappel se déclenche. */
export function isDue(dose: DoseLike, now: Date = new Date()): boolean {
  return dose.statut === 'EN_ATTENTE' && new Date(dose.datePrevue).getTime() <= now.getTime();
}
