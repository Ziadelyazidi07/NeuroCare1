/**
 * Audio du rappel : uniquement la voix de l'aidant, téléchargée à l'avance pour rester utilisable hors
 * ligne. Tant qu'aucune voix n'est disponible, le téléphone joue une simple tonalité.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { seniorApi } from '../api/api';
import type { DoseDto, Language } from '../api/types';
import { ApiError } from '../lib/problem';

const REMINDER_TONE = require('../../assets/audio/tonalite-rappel.wav');

/** Confirmation après « C'est fait » (provisoire, à remplacer par des voix enregistrées — EF-VO-05). */
const THANKS = { fr: require('../../assets/audio/merci-fr.mp3'), ar: require('../../assets/audio/merci-ar.mp3') };

/** Formats possibles : MP3 pour un message cloné, ceux de l'enregistrement de l'aidant sinon. */
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav'];

const audioDir = new Directory(Paths.cache, 'rappels-audio');
let player: AudioPlayer | null = null;

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

/**
 * Télécharge la voix de chaque traitement (URL signée de 5 min, utilisée tout de suite). Sans fichier
 * côté serveur (404), l'ancien est effacé : une voix retirée n'est plus jouée.
 */
export async function prefetchReminderAudio(doses: DoseDto[]): Promise<void> {
  audioDir.create({ intermediates: true, idempotent: true });
  const medicationIds = [...new Set(doses.map((d) => d.medicationId).filter((id): id is string => !!id))];
  for (const medicationId of medicationIds) {
    try {
      const { url, extension } = await seniorApi.medicationAudio(medicationId);
      const target = localFile(medicationId, AUDIO_EXTENSIONS.includes(extension) ? extension : 'mp3');
      await File.downloadFileAsync(url, target, { idempotent: true });
      deleteLocalFiles(medicationId, target);
    } catch (error) {
      // Réseau absent : on garde l'éventuel fichier précédent pour les rappels hors ligne.
      if (error instanceof ApiError && error.status === 404) deleteLocalFiles(medicationId);
    }
  }
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
  await play(reminderVoice(dose)?.uri ?? REMINDER_TONE);
}

/** Retour sonore après « C'est fait ». */
export async function playThanks(language: Language): Promise<void> {
  await play(language === 'FR' ? THANKS.fr : THANKS.ar);
}

export function stopAudio(): void {
  player?.remove();
  player = null;
}
