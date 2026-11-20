/**
 * Dictionnaire français complet (langue par défaut). Chaque section vit dans `fr/` ; le dictionnaire arabe
 * (`ar.ts`) a exactement la même forme, vérifiée par TypeScript.
 */
import bp from './fr/bp';
import common from './fr/common';
import findrisc from './fr/findrisc';
import gds from './fr/gds';
import memory from './fr/memory';
import observance from './fr/observance';
import spo2 from './fr/spo2';

export const fr = { ...common, ...observance, spo2, gds, findrisc, bp, memory };

export type Dictionary = typeof fr;
