/** Son des rappels : libellés communs aux espaces aidant et senior. */
import type { ReminderSoundMode } from '../api/types';

export const REMINDER_SOUND_OPTIONS: { mode: ReminderSoundMode; label: string; description: string }[] = [
  {
    mode: 'STANDARD',
    label: 'Son standard',
    description: 'Le message de rappel habituel, sans enregistrement.',
  },
  {
    mode: 'PERSONNALISE',
    label: 'Voix personnalisée',
    description: 'La voix enregistrée par le proche. Sans enregistrement, le son standard est joué.',
  },
];
