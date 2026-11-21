/**
 * Base de connaissances de l'Assistant Santé : fiches sourcées (OMS, HAS, ESC, FID), traduites en français
 * et en arabe, avec mots-clés français, arabes et darija. La copie embarquée (`knowledge-base.json`) est
 * identique à celle du microservice `services/assistant-service` (vérifié par les tests) : l'assistant
 * fonctionne 100 % hors ligne et se met à jour quand le service est joignable.
 */
import type { ModuleId } from '../types';
import EMBEDDED_JSON from './knowledge-base.json';

export type KbLanguage = 'fr' | 'ar';
export type SourceOrg = 'OMS' | 'HAS' | 'ESC' | 'FID';
export type Category = 'observance' | 'hta' | 'diabete' | 'spo2' | 'memoire' | 'mental' | 'urgence';
export type Translated = Record<KbLanguage, string>;

export type KbAction = { type: 'call'; number: string } | { type: 'module'; module: ModuleId };

export interface Topic {
  id: string;
  category: Category;
  /** Signe de gravité : fiche prioritaire, toujours accompagnée des boutons 15 / 141. */
  urgent: boolean;
  keywords: { fr: string[]; ar: string[]; darija: string[] };
  title: Translated;
  answer: Translated;
  source: { orgs: SourceOrg[]; reference: Translated };
  actions: KbAction[];
}

export interface KnowledgeBase {
  version: string;
  updatedAt: string;
  disclaimer: Translated;
  sources: Record<SourceOrg, Translated & { name: string }>;
  suggestions: { fr: string[]; ar: string[]; darija: string[] };
  fallback: Translated;
  topics: Topic[];
}

export const EMBEDDED_KB = EMBEDDED_JSON as KnowledgeBase;

const MODULE_IDS: readonly string[] = ['observance', 'saturation', 'mental', 'metabolic', 'cardio', 'alzheimer'];
const ORGS: readonly string[] = ['OMS', 'HAS', 'ESC', 'FID'];

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTranslated = (value: unknown): value is Translated =>
  typeof value === 'object' && value !== null && isText((value as Translated).fr) && isText((value as Translated).ar);

/** Contrôle une base reçue du serveur avant de la garder (une base mal formée est ignorée). */
export function isKnowledgeBase(value: unknown): value is KnowledgeBase {
  if (typeof value !== 'object' || value === null) return false;
  const kb = value as Partial<KnowledgeBase>;
  if (!isText(kb.version) || !isTranslated(kb.disclaimer) || !isTranslated(kb.fallback) || !Array.isArray(kb.topics) || kb.topics.length === 0) return false;
  if (!kb.suggestions || !Array.isArray(kb.suggestions.fr) || !Array.isArray(kb.suggestions.ar) || !Array.isArray(kb.suggestions.darija)) return false;
  return kb.topics.every(
    (t) =>
      isText(t?.id) &&
      isTranslated(t.title) &&
      isTranslated(t.answer) &&
      isTranslated(t.source?.reference) &&
      Array.isArray(t.source?.orgs) &&
      t.source.orgs.length > 0 &&
      t.source.orgs.every((o) => ORGS.includes(o)) &&
      Array.isArray(t.keywords?.fr) &&
      Array.isArray(t.keywords?.ar) &&
      Array.isArray(t.keywords?.darija) &&
      Array.isArray(t.actions) &&
      t.actions.every((a) => (a.type === 'call' ? isText(a.number) : a.type === 'module' && MODULE_IDS.includes(a.module))),
  );
}

/** Compare deux versions « 2026.11.1 » segment par segment (> 0 si `a` est plus récente). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/** « Source : OMS · HAS — référence » : sigles des organismes et référence dans la langue de la réponse. */
export function sourceLine(kb: KnowledgeBase, topic: Topic, lang: KbLanguage): string {
  const orgs = topic.source.orgs.map((o) => (lang === 'ar' ? (kb.sources[o]?.ar ?? o) : o)).join(' · ');
  return `${orgs} — ${topic.source.reference[lang]}`;
}
