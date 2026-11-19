/**
 * Audio du rappel : uniquement la voix de l'aidant, téléchargée à l'avance pour rester utilisable hors
 * ligne. Tant qu'aucune voix n'est disponible, le téléphone joue une simple tonalité.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { seniorApi } from '../api/api';
import type { DoseDto } from '../api/types';
import { ApiError } from '../lib/problem';

const REMINDER_TONE = require('../../assets/audio/tonalite-rappel.wav');

/** Formats possibles : MP3 pour un message cloné, ceux de l'enregistrement de l'aidant sinon. */
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav'];

/** Attente maximale d'un téléchargement en cours avant de jouer la tonalité à la place de la voix. */
const DOWNLOAD_WAIT_MS = 2000;

const audioDir = new Directory(Paths.cache, 'rappels-audio');
let player: AudioPlayer | null = null;
let downloads: Promise<void> = Promise.resolve();

function localFile(medicationId: string, extension: string): File {
  // Extension explicite : le lecteur iOS s'appuie dessus pour un fichier local.
  return new File(audioDir, `${medicationId}.${extension}`);
}

function localFiles(medicationId: string): File[] {
  return AUDIO_EXTENSIONS.map((extension) => localFile(medicationId, extension));
}

function deleteLocalFiles(medicationId: string, keep?: File): void {
  for (const file of localFiles(medicationId)) {
    if (file.uri !== keep?.uri && file.exists) file.delete();
  }
}

async function downloadVoice(medicationId: string): Promise<void> {
  // Fichier temporaire : sur Android, un téléchargement interrompu laisserait un audio tronqué.
  const temporary = new File(audioDir, `${medicationId}.tmp`);
  try {
    const { url, extension } = await seniorApi.medicationAudio(medicationId);
    const target = localFile(medicationId, AUDIO_EXTENSIONS.includes(extension) ? extension : 'mp3');
    await File.downloadFileAsync(url, temporary, { idempotent: true });
    await temporary.move(target, { overwrite: true });
    deleteLocalFiles(medicationId, target);
  } catch (error) {
    if (temporary.exists) temporary.delete();
    // Réseau absent : on garde l'éventuel fichier précédent pour les rappels hors ligne.
    if (error instanceof ApiError && error.status === 404) deleteLocalFiles(medicationId);
  }
}

/**
 * Télécharge la voix de chaque traitement (URL signée de 5 min, utilisée tout de suite), un lot à la fois.
 * Sans fichier côté serveur (404), l'ancien est effacé : une voix retirée n'est plus jouée.
 */
export function prefetchReminderAudio(doses: DoseDto[]): Promise<void> {
  const medicationIds = [...new Set(doses.map((d) => d.medicationId).filter((id): id is string => !!id))];
  downloads = downloads.then(async () => {
    audioDir.create({ intermediates: true, idempotent: true });
    for (const medicationId of medicationIds) await downloadVoice(medicationId);
  });
  return downloads;
}

async function waitForDownloads(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([downloads, new Promise((resolve) => (timer = setTimeout(resolve, DOWNLOAD_WAIT_MS)))]);
  clearTimeout(timer);
}

async function play(source: string | number): Promise<void> {
  await setAudioModeAsync({ playsInSilentMode: true });
  player?.remove();
  player = createAudioPlayer(source);
  player.play();
}

function reminderVoice(dose: DoseDto | null): File | undefined {
  return dose?.medicationId ? localFiles(dose.medicationId).find((file) => file.exists) : undefined;
}

/** Vrai si la voix de l'aidant est disponible sur le téléphone pour cette prise. */
export function hasReminderVoice(dose: DoseDto | null): boolean {
  return reminderVoice(dose) !== undefined;
}

/** Joue le rappel d'une prise : voix de l'aidant si elle existe, sinon tonalité. */
export async function playReminder(dose: DoseDto | null): Promise<void> {
  if (dose?.medicationId && !hasReminderVoice(dose)) await waitForDownloads();
  await play(reminderVoice(dose)?.uri ?? REMINDER_TONE);
}

/** Arrête la lecture en cours (voix du rappel). */
export function stopAudio(): void {
  player?.remove();
  player = null;
}
