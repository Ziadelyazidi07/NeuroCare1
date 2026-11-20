/**
 * Langue de l'application (français ou arabe), mémorisée sur le téléphone et appliquée instantanément.
 * Le sens droite-à-gauche est géré par des styles (`row-reverse`, `textAlign`, `writingDirection`) et non par
 * `I18nManager.forceRTL`, qui imposerait un redémarrage de l'application.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import type AsyncStorageModule from '@react-native-async-storage/async-storage';

import { ar } from './ar';
import { fr, type Dictionary } from './fr';

export type Language = 'fr' | 'ar';

export const LANGUAGE_KEY = '@neurocare/language';
export const DICTIONARIES: Record<Language, Dictionary> = { fr, ar };

type AsyncStorageStatic = typeof AsyncStorageModule;

let current: Language = 'fr';

/**
 * Stockage chargé à la demande : la logique pure (calculs, PDF) et ses tests importent les dictionnaires sans
 * dépendre du module natif AsyncStorage.
 */
async function storage(): Promise<AsyncStorageStatic> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- chargement différé volontaire
  const loaded = require('@react-native-async-storage/async-storage') as { default?: AsyncStorageStatic } & AsyncStorageStatic;
  return loaded.default ?? loaded;
}

/** Langue en cours, pour le code hors composants (notifications, PDF). */
export function currentLanguage(): Language {
  return current;
}

export function dictionaryFor(language: Language): Dictionary {
  return DICTIONARIES[language];
}

export interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
  isRTL: boolean;
  /** Rangée dans le sens de lecture (`row` ou `row-reverse`). */
  row: { flexDirection: ViewStyle['flexDirection'] };
  /** Texte aligné sur le début de la ligne dans le sens de lecture. */
  text: Pick<TextStyle, 'textAlign' | 'writingDirection'>;
  /** Élément calé au début de la ligne (`flex-start` ou `flex-end`). */
  start: { alignSelf: ViewStyle['alignSelf'] };
}

function valueFor(language: Language, setLanguage: (language: Language) => void): LanguageValue {
  const isRTL = language === 'ar';
  return {
    language,
    setLanguage,
    t: DICTIONARIES[language],
    isRTL,
    row: { flexDirection: isRTL ? 'row-reverse' : 'row' },
    text: { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
    start: { alignSelf: isRTL ? 'flex-end' : 'flex-start' },
  };
}

// Sans fournisseur (tests unitaires d'un écran), l'application est en français.
const LanguageContext = createContext<LanguageValue>(valueFor('fr', () => undefined));

export function isLanguage(value: unknown): value is Language {
  return value === 'fr' || value === 'ar';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language | null>(null);

  useEffect(() => {
    let active = true;
    storage()
      .then((s) => s.getItem(LANGUAGE_KEY))
      .catch(() => null)
      .then((saved) => {
        if (!active) return;
        const initial = isLanguage(saved) ? saved : 'fr';
        current = initial;
        setState(initial);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    current = next;
    setState(next);
    void storage()
      .then((s) => s.setItem(LANGUAGE_KEY, next))
      .catch(() => undefined);
  }, []);

  const value = useMemo(() => valueFor(language ?? 'fr', setLanguage), [language, setLanguage]);
  // Attend la langue mémorisée (lecture locale, quasi immédiate) pour ne pas afficher l'autre langue un instant.
  if (language === null) return null;
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}
