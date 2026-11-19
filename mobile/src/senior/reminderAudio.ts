/**
 * Audio du rappel avec la chaîne de repli du cahier (§10.4) côté téléphone :
 * 1-2. fichier choisi par le serveur selon le son du senior (voix de l'aidant ou TTS), téléchargé à
 *      l'avance — utilisable hors ligne ;
 * 3.   audio générique embarqué dans l'application (darija / arabe, ou français).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { seniorApi } from '../api/api';
import type { DoseDto, Language } from '../api/types';
import { ApiError } from '../lib/problem';

/** Audios génériques embarqués (provisoires, à remplacer par des voix enregistrées — EF-VO-05). */
const BUNDLED = {
  rappel: { fr: require('../../assets/audio/rappel-fr.mp3'), ar: require('../../assets/audio/rappel-ar.mp3') },
  merci: { fr: require('../../assets/audio/merci-fr.mp3'), ar: require('../../assets/audio/merci-ar.mp3') },
};

/** Formats possibles : MP3 pour les messages générés, ceux de l'enregistrement de l'aidant sinon. */
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav'];

const audioDir = new Directory(Paths.cache, 'rappels-audio');
let player: AudioPlayer | null = null;

function bundled(kind: keyof typeof BUNDLED, language: Language): number {
  return language === 'FR' ? BUNDLED[kind].fr : BUNDLED[kind].ar;
}

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
 * Télécharge l'audio de chaque traitement (URL signée de 5 min, utilisée tout de suite). Sans fichier
 * côté serveur (404), l'ancien est effacé : la voix retirée n'est plus jouée et le repli embarqué prend le relais.
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

/** Joue le rappel d'une prise : fichier personnalisé s'il existe, sinon audio embarqué. */
export async function playReminder(dose: DoseDto | null, language: Language): Promise<void> {
  const file = dose?.medicationId ? localFiles(dose.medicationId).find((candidate) => candidate.exists) : undefined;
  await play(file ? file.uri : bundled('rappel', language));
}

/** Retour sonore après « C'est fait ». */
export async function playThanks(language: Language): Promise<void> {
  await play(bundled('merci', language));
}

export function stopAudio(): void {
  player?.remove();
  player = null;
}
