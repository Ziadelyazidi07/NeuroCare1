/**
 * Voix de l'assistant : lecture des réponses (expo-speech, débit ralenti pour les seniors) et dictée
 * (expo-speech-recognition : français, arabe standard, darija marocaine « ar-MA », hors ligne si le
 * téléphone a le pack de langue). Les modules natifs sont chargés à la demande : sur un ancien build qui
 * ne les contient pas, l'assistant reste utilisable au clavier (dictée du clavier) au lieu de planter.
 */
import type { KbLanguage } from './knowledge';

type SpeechModule = typeof import('expo-speech');
type RecognitionModule = typeof import('expo-speech-recognition')['ExpoSpeechRecognitionModule'];

/** Débit de lecture : légèrement ralenti (1 = normal). */
export const SPEECH_RATE = 0.85;

/** Langue parlée pour la dictée : français, arabe standard ou darija marocaine. */
export type SpokenLanguage = 'fr' | 'ar' | 'darija';
export const SPOKEN_LOCALES: Record<SpokenLanguage, string> = { fr: 'fr-FR', ar: 'ar-SA', darija: 'ar-MA' };

let speech: SpeechModule | null | undefined;
let recognition: RecognitionModule | null | undefined;

function speechModule(): SpeechModule | null {
  if (speech === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- module natif facultatif (anciens builds)
      speech = require('expo-speech') as SpeechModule;
    } catch {
      speech = null;
    }
  }
  return speech;
}

function recognitionModule(): RecognitionModule | null {
  if (recognition === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- module natif facultatif (anciens builds)
      recognition = (require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule ?? null;
    } catch {
      recognition = null;
    }
  }
  return recognition;
}

/** Lit un texte à voix haute ; `onDone` est appelé à la fin (ou à l'arrêt). Renvoie false sans synthèse vocale. */
export function speak(text: string, lang: KbLanguage, onDone?: () => void): boolean {
  const s = speechModule();
  if (!s) return false;
  try {
    s.stop();
    s.speak(text, { language: lang === 'ar' ? 'ar' : 'fr-FR', rate: SPEECH_RATE, onDone, onStopped: onDone, onError: onDone });
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  try {
    speechModule()?.stop();
  } catch {
    // rien à arrêter
  }
}

export function dictationAvailable(): boolean {
  try {
    return recognitionModule()?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

export type DictationError = 'unavailable' | 'denied' | 'failed';

export interface DictationHandlers {
  /** Texte reconnu (provisoire puis final). */
  onText: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (error: DictationError) => void;
}

/** Démarre la dictée ; renvoie une fonction d'arrêt (ou null si la dictée n'a pas pu démarrer). */
export async function startDictation(spoken: SpokenLanguage, handlers: DictationHandlers): Promise<(() => void) | null> {
  const module = recognitionModule();
  if (!module || !dictationAvailable()) {
    handlers.onError('unavailable');
    return null;
  }
  try {
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      handlers.onError('denied');
      return null;
    }
    const subscriptions = [
      module.addListener('result', (event) => {
        const text = event.results[0]?.transcript ?? '';
        if (text) handlers.onText(text, event.isFinal);
      }),
      module.addListener('error', (event) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') handlers.onError(event.error === 'not-allowed' ? 'denied' : 'failed');
      }),
      module.addListener('end', () => {
        subscriptions.forEach((s) => s.remove());
        handlers.onEnd();
      }),
    ];
    module.start({ lang: SPOKEN_LOCALES[spoken], interimResults: true, continuous: false, addsPunctuation: false });
    return () => module.stop();
  } catch {
    handlers.onError('failed');
    return null;
  }
}
