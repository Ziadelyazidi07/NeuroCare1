/** Contrats de l'API NeuroCare (backend Spring Boot, /api/v1). Les champs nuls sont omis par le serveur. */
import type { DoseStatus, PillColour } from '../lib/doses';

export type Language = 'DARIJA' | 'FR' | 'AR';
export type ConsentType = 'RAPPELS' | 'EXERCICES' | 'PARTAGE_FAMILIAL' | 'VOIX';
export type JourSemaine = 'LUN' | 'MAR' | 'MER' | 'JEU' | 'VEN' | 'SAM' | 'DIM';
export const JOURS: JourSemaine[] = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export interface UserSummary {
  id: string;
  nomComplet: string;
  role: 'SENIOR' | 'AIDANT' | 'MEDECIN' | 'ADMIN';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserSummary;
}

export interface PairingRedeemResponse {
  deviceToken: string;
  seniorId: string;
  nomComplet: string;
}

export interface DeviceDto {
  id: string;
  plateforme: 'ANDROID' | 'IOS';
  revoque: boolean;
  derniereActivite?: string;
}

export interface PairingCodeResponse {
  code: string;
  expireLe: string;
}

export interface SeniorDto {
  id: string;
  nomComplet: string;
  langue: Language;
  fuseau: string;
  taillePolice: number;
  contrasteEleve: boolean;
  delaiSansReponseMin: number;
  contactUrgenceNom?: string;
  contactUrgenceTel?: string;
  donneesFictives: boolean;
  anneeNaissance?: number;
  lien?: { lienParente?: string; surnomSenior?: string; consentementValide: boolean; dateConsentement?: string };
}

export interface CreateSeniorRequest {
  nomComplet: string;
  langue: Language;
  surnomSenior?: string;
  lienParente?: string;
  contactUrgenceNom?: string;
  contactUrgenceTel?: string;
  anneeNaissance?: number;
}

export interface DoseDto {
  id: string;
  medicationId?: string;
  nomMedicament?: string;
  consigne?: string;
  datePrevue: string;
  statut: DoseStatus;
  horodatageAction?: string;
}

export interface SyncResponse {
  resultats: { doseId: string; clientRequestId: string; resultat: 'APPLIQUEE' | 'DEJA_APPLIQUEE' | 'REFUSEE' | 'INTROUVABLE'; statut?: DoseStatus }[];
}

export interface HoraireDto {
  id?: string;
  heure: string;
  jours: JourSemaine[];
}

export interface MedicationDto {
  id: string;
  seniorId: string;
  nomMedicament: string;
  consigne?: string;
  dateDebut: string;
  dateFin?: string;
  actif: boolean;
  horaires: HoraireDto[];
}

export interface MedicationRequest {
  nomMedicament: string;
  consigne?: string;
  dateDebut: string;
  dateFin?: string;
  horaires: { heure: string; jours: JourSemaine[] }[];
}

export interface ConsentDto {
  type: ConsentType;
  accorde: boolean;
  versionTexte?: string;
  dateMaj?: string;
}

export interface ConsentHistoryDto {
  type: ConsentType;
  accorde: boolean;
  versionTexte: string;
  auteurId: string;
  canal: 'APP_SENIOR' | 'APP_AIDANT';
  horodatage: string;
}

export interface PriseDto {
  doseId: string;
  medicationId?: string;
  nomMedicament?: string;
  consigne?: string;
  datePrevue: string;
  statut: DoseStatus;
  couleur: PillColour;
  horodatageAction?: string;
}

export interface DashboardToday {
  seniorId: string;
  date: string;
  prises: PriseDto[];
  resume: { total: number; confirmees: number; sansReponse: number; enAttente: number; desactivees: number };
  dernierExercice?: { sessionId: string; dateExercice: string; motsPresentes: number; corrects: number; interrompu: boolean };
  avertissement: string;
}

export interface DashboardHistory {
  du: string;
  au: string;
  jours: { date: string; confirmees: number; sansReponse: number; enAttente: number; desactivees: number; tauxConfirmation?: number }[];
  tauxConfirmationPeriode?: number;
  exercices: { dateExercice: string; motsPresentes: number; corrects: number; tauxReussite?: number; interrompu: boolean }[];
  avertissement: string;
}

export interface VoiceProfileDto {
  id: string;
  statut: 'EN_COURS' | 'PRET' | 'ECHEC';
  dateCreation: string;
}

export interface SignedAudioUrl {
  url: string;
  expireLe: string;
}

export interface WordDto {
  mot: string;
  ecritureArabe?: string;
}

export interface ExerciseDto {
  type: 'RAPPEL_MOTS';
  langue: Language;
  motsPresentes: WordDto[];
  propositions: WordDto[];
  delaiRappelSec: number;
  facultatif: boolean;
}

export interface CognitiveSessionRequest {
  type: 'RAPPEL_MOTS';
  motsPresentes: string[];
  propositions: string[];
  motsChoisis: string[];
  delaiRappelSec: number;
  tempsReponseMs: number[];
  dureeSec: number;
  interrompu: boolean;
}

export interface CognitiveSessionDto {
  id: string;
  dateExercice: string;
  motsPresentes: number;
  corrects: number;
  interrompu: boolean;
}

/** Messages du topic /topic/seniors/{seniorId}/events (cahier §9.4). */
export type RealtimeEvent =
  | { type: 'DOSE_STATUS_CHANGED'; doseId: string; seniorId: string; medication?: string; datePrevue: string; statut: DoseStatus; couleur: PillColour }
  | { type: 'COGNITIVE_SESSION_COMPLETED'; sessionId: string; seniorId: string; dateExercice: string; interrompu: boolean }
  | { type: 'VOICE_PROFILE_READY'; voiceProfileId: string; seniorId: string; statut: VoiceProfileDto['statut'] }
  | { type: 'DEVICE_UNREACHABLE'; seniorId: string; detecteLe: string };
