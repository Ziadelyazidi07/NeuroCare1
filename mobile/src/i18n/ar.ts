/** Dictionnaire arabe complet : arabe clair et bienveillant, même forme que le dictionnaire français. */
import assistant from './ar/assistant';
import bp from './ar/bp';
import common from './ar/common';
import findrisc from './ar/findrisc';
import gds from './ar/gds';
import memory from './ar/memory';
import observance from './ar/observance';
import spo2 from './ar/spo2';
import type { Dictionary } from './fr';

export const ar: Dictionary = { ...common, ...observance, spo2, gds, findrisc, bp, memory, assistant };
