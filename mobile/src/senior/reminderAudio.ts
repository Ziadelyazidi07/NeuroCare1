/**
 * Audio du rappel avec la chaîne de repli du cahier (§10.4) côté téléphone :
 * 1-2. fichier personnalisé (voix de l'aidant ou TTS) téléchargé à l'avance — utilisable hors ligne ;
 * 3.   audio générique embarqué dans l'application (darija / arabe, ou français).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';

import { seniorApi } from '../api/api';
import type { DoseDto, Language } from '../api/types';

/** Audios génériques embarqués (provisoires, à remplacer par des voix enregistrées — EF-VO-05). */
const BUNDLED = {
  rappel: { fr: require('../../assets/audio/rappel-fr.mp3'), ar: require('../../assets/audio/rappel-ar.mp3') },
  merci: { fr: require('../../assets/audio/merci-fr.mp3'), ar: require('../../assets/audio/merci-ar.mp3') },
};

const audioDir = new Directory(Paths.cache, 'rappels-audio');
let player: AudioPlayer | null = null;

function bundled(kind: keyof typeof BUNDLED, language: Language): number {
  return language === 'FR' ? BUNDLED[kind].fr : BUNDLED[kind].ar;
}

function localFile(medicationId: string): File {
  // Extension explicite : le lecteur iOS s'appuie dessus pour un fichier local (le service produit du MP3).
  return new File(audioDir, `${medicationId}.mp3`);
}

/**
 * Télécharge l'audio personnalisé de chaque traitement (URL signée de 5 min, utilisée tout de suite).
 * Sans fichier prêt côté serveur (404), le repli embarqué sera joué.
 */
export async function prefetchReminderAudio(doses: DoseDto[]): Promise<void> {
  audioDir.create({ intermediates: true, idempotent: true });
  const medicationIds = [...new Set(doses.map((d) => d.medicationId).filter((id): id is string => !!id))];
  for (const medicationId of medicationIds) {
    try {
      const { url } = await seniorApi.medicationAudio(medicationId);
      await File.downloadFileAsync(url, localFile(medicationId), { idempotent: true });
    } catch {
      // Pas d'audio personnalisé (ou réseau absent) : on garde l'éventuel fichier précédent.
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
  const file = dose?.medicationId ? localFile(dose.medicationId) : null;
  await play(file?.exists ? file.uri : bundled('rappel', language));
}

/** Retour sonore après « C'est fait ». */
export async function playThanks(language: Language): Promise<void> {
  await play(bundled('merci', language));
}

export function stopAudio(): void {
  player?.remove();
  player = null;
}
