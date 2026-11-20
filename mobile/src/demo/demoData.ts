/**
 * Données de démonstration du Module 1 (mode démo hors ligne) : un aidant, une senior fictive, trois
 * traitements réalistes, 7 jours d'historique d'observance, consentements, téléphone appairé et exercices.
 * Les prises sont recalculées à partir des horaires : seuls les statuts modifiés sont enregistrés.
 */
import type {
  CognitiveSessionDto,
  ConsentDto,
  ConsentHistoryDto,
  ConsentType,
  DeviceDto,
  DoseDto,
  JourSemaine,
  MedicationDto,
  SeniorDto,
  VoiceProfileDto,
} from '../api/types';
import { JOURS } from '../api/types';
import type { DoseStatus } from '../lib/doses';

export const DEMO_AIDANT = { id: 'demo-aidant', nomComplet: 'Salma (démo)' };
export const DEMO_SENIOR_ID = 'demo-senior-zahra';
/** Traitement dont l'horaire est recalé à l'entrée en démo pour qu'un « C'est fait » soit toujours possible. */
export const DEMO_LIVE_MEDICATION_ID = 'demo-med-vitd';

export interface DemoExercise extends CognitiveSessionDto {
  seniorId: string;
}

export interface DemoState {
  version: 1;
  seniors: SeniorDto[];
  medications: MedicationDto[];
  /** Statuts modifiés (« C'est fait »), par identifiant de prise. */
  statuses: Record<string, { statut: DoseStatus; horodatageAction?: string }>;
  consents: Record<string, ConsentDto[]>;
  consentHistory: (ConsentHistoryDto & { seniorId: string })[];
  voices: Record<string, VoiceProfileDto | null>;
  devices: Record<string, DeviceDto[]>;
  exercises: DemoExercise[];
}

export const CONSENT_TYPES: ConsentType[] = ['RAPPELS', 'EXERCICES', 'PARTAGE_FAMILIAL', 'VOIX'];
const ALL_DAYS: JourSemaine[] = [...JOURS];

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** « 2026-11-20 » en heure locale. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** « 08:05 » en heure locale. */
export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** Jour de la semaine au format de l'API (LUN … DIM). */
export function jourOf(d: Date): JourSemaine {
  return JOURS[(d.getDay() + 6) % 7] as JourSemaine;
}

/** Horaire « dans 2 minutes », arrondi à la minute. */
export function soonTime(now: Date): string {
  return localTime(new Date(now.getTime() + 2 * 60_000));
}

export function seedState(now = new Date()): DemoState {
  const start = localDay(addDays(now, -14));
  const at = (daysAgo: number, time: string) => {
    const [h, m] = time.split(':').map(Number);
    const d = addDays(startOfDay(now), -daysAgo);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString();
  };
  const senior: SeniorDto = {
    id: DEMO_SENIOR_ID,
    nomComplet: 'Hajja Zahra',
    langue: 'DARIJA',
    fuseau: 'Africa/Casablanca',
    taillePolice: 30,
    contrasteEleve: false,
    delaiSansReponseMin: 60,
    contactUrgenceNom: 'Salma',
    contactUrgenceTel: '+212600000000',
    donneesFictives: true,
    anneeNaissance: 1952,
    lien: { lienParente: 'Fille', surnomSenior: 'Mima', consentementValide: true, dateConsentement: at(14, '10:00') },
  };
  const medication = (id: string, nomMedicament: string, consigne: string, heures: string[]): MedicationDto => ({
    id,
    seniorId: DEMO_SENIOR_ID,
    nomMedicament,
    consigne,
    dateDebut: start,
    actif: true,
    horaires: heures.map((heure, i) => ({ id: `${id}-h${i}`, heure, jours: ALL_DAYS })),
  });
  return {
    version: 1,
    seniors: [senior],
    medications: [
      medication('demo-med-metformine', 'Metformine 850 mg', '1 comprimé pendant le repas', ['08:00', '20:00']),
      medication('demo-med-amlodipine', 'Amlodipine 5 mg', '1 comprimé le matin', ['09:00']),
      medication(DEMO_LIVE_MEDICATION_ID, 'Vitamine D3', '10 gouttes dans un verre d’eau', [soonTime(now)]),
    ],
    statuses: {},
    consents: {
      [DEMO_SENIOR_ID]: CONSENT_TYPES.map((type) => ({ type, accorde: true, versionTexte: 'v1', dateMaj: at(14, '10:00') })),
    },
    consentHistory: CONSENT_TYPES.map((type) => ({
      seniorId: DEMO_SENIOR_ID,
      type,
      accorde: true,
      versionTexte: 'v1',
      auteurId: DEMO_AIDANT.id,
      canal: 'APP_AIDANT' as const,
      horodatage: at(14, '10:00'),
    })),
    voices: { [DEMO_SENIOR_ID]: { id: 'demo-voice', statut: 'PRET', dateCreation: at(13, '18:30') } },
    devices: { [DEMO_SENIOR_ID]: [{ id: 'demo-device', plateforme: 'ANDROID', revoque: false, derniereActivite: now.toISOString() }] },
    exercises: [
      { seniorId: DEMO_SENIOR_ID, id: 'demo-ex-1', dateExercice: at(5, '16:10'), motsPresentes: 3, corrects: 3, interrompu: false },
      { seniorId: DEMO_SENIOR_ID, id: 'demo-ex-2', dateExercice: at(3, '16:30'), motsPresentes: 3, corrects: 2, interrompu: false },
      { seniorId: DEMO_SENIOR_ID, id: 'demo-ex-3', dateExercice: at(1, '17:05'), motsPresentes: 3, corrects: 3, interrompu: false },
    ],
  };
}

/** Petit hachage stable : rend l'historique simulé identique d'un affichage à l'autre. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Statut simulé d'une prise passée sans action enregistrée : surtout confirmée, parfois sans réponse. */
function simulatedPast(id: string, datePrevue: Date): { statut: DoseStatus; horodatageAction?: string } {
  if (hash(id) % 7 === 0) return { statut: 'SANS_REPONSE' };
  return { statut: 'CONFIRME', horodatageAction: new Date(datePrevue.getTime() + ((hash(id) % 12) + 2) * 60_000).toISOString() };
}

/** Prises d'une senior entre deux instants, calculées depuis les horaires des traitements actifs. */
export function dosesBetween(state: DemoState, seniorId: string, from: Date, to: Date, now = new Date()): DoseDto[] {
  const senior = state.seniors.find((s) => s.id === seniorId);
  const delayMs = (senior?.delaiSansReponseMin ?? 60) * 60_000;
  const doses: DoseDto[] = [];
  for (const med of state.medications) {
    if (med.seniorId !== seniorId || !med.actif) continue;
    for (let day = startOfDay(from); day <= to; day = addDays(day, 1)) {
      const iso = localDay(day);
      if (iso < med.dateDebut || (med.dateFin && iso > med.dateFin)) continue;
      for (const horaire of med.horaires) {
        if (!horaire.jours.includes(jourOf(day))) continue;
        const [h, m] = horaire.heure.split(':').map(Number);
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (when < from || when > to) continue;
        const id = `${med.id}@${iso}T${horaire.heure}`;
        const status =
          state.statuses[id] ?? (now.getTime() - when.getTime() > delayMs ? simulatedPast(id, when) : { statut: 'EN_ATTENTE' as DoseStatus });
        doses.push({ id, medicationId: med.id, nomMedicament: med.nomMedicament, consigne: med.consigne, datePrevue: when.toISOString(), ...status });
      }
    }
  }
  return doses.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue));
}

/** Mots de l'exercice de rappel (français et écriture arabe). */
export const DEMO_WORDS = [
  { mot: 'Pain', ecritureArabe: 'خبز' },
  { mot: 'Jardin', ecritureArabe: 'حديقة' },
  { mot: 'Thé', ecritureArabe: 'أتاي' },
  { mot: 'Soleil', ecritureArabe: 'شمس' },
  { mot: 'Porte', ecritureArabe: 'باب' },
  { mot: 'Orange', ecritureArabe: 'ليمون' },
];
