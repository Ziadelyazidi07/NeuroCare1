/**
 * Moteur de recherche local de l'Assistant Santé (100 % hors ligne) : normalisation français / arabe /
 * darija (accents, hamza, tâ marbûta, voyelles courtes, article « ال » et préfixes و ب ف ل, arabizi
 * « 3 7 9 »), mots vides, mots-clés et synonymes, tolérance d'une faute de frappe. Les fiches urgentes
 * passent en premier dès qu'un de leurs signes est reconnu. Aucune réponse n'est inventée : sans fiche
 * correspondante, l'assistant le dit et propose des questions.
 */
import type { KbLanguage, KnowledgeBase, Topic } from './knowledge';

const ARABIC_LETTER = /[ء-ي]/;

/** Chiffres de l'arabizi (darija écrite en lettres latines) : « 3 » = ع, « 7 » = ح, « 9 » = ق… */
const ARABIZI: Record<string, string> = { '2': 'a', '3': 'a', '5': 'kh', '7': 'h', '9': 'q' };

const STOPWORDS = new Set([
  // français
  'le', 'la', 'les', 'l', 'de', 'des', 'du', 'd', 'un', 'une', 'a', 'au', 'aux', 'et', 'ou', 'en', 'mon', 'ma', 'mes', 'ce', 'cet', 'cette',
  'je', 'j', 'me', 'm', 'moi', 'est', 'suis', 'ai', 'pas', 'plus', 'tres', 'trop', 'que', 'qui', 'quoi', 'il', 'elle', 'on', 'y', 'se', 's',
  'avec', 'pour', 'dans', 'sur', 'par', 'c', 'ca', 'quand', 'faire', 'fait', 'dois', 'peux', 'vous', 'votre', 'vos', 'tu', 'ton', 'ta',
  // arabe standard
  'في', 'من', 'على', 'الى', 'عن', 'ما', 'هل', 'انا', 'لي', 'هو', 'هي', 'مع', 'او', 'ان', 'كيف', 'ماذا', 'عندي',
  // darija
  'ديال', 'ديالي', 'شنو', 'واش', 'راه', 'راني', 'بزاف', 'شي', 'غير', 'هاد', 'هادي', 'كيفاش',
]);

/** Texte comparable : minuscules, sans accents ni voyelles courtes, formes arabes unifiées, arabizi converti. */
export function normalize(text: string): string {
  let s = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/[ً-ٰٕـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[ڭگ]/g, 'ك')
    .replace(/ڤ/g, 'ف')
    .replace(/پ/g, 'ب');
  // Arabizi : un chiffre collé à des lettres latines est une lettre (« n9is », « sokar tal3 »).
  s = s.replace(/[a-z]*[23579][a-z0-9]*/g, (word) => (/[a-z]/.test(word) ? word.replace(/[23579]/g, (d) => ARABIZI[d] ?? d) : word));
  return s
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Formes équivalentes d'un mot : article et préfixes arabes retirés, « اء » final = « ا », pluriel latin. */
function variants(token: string): string[] {
  const forms = new Set([token]);
  if (ARABIC_LETTER.test(token)) {
    let core = token.replace(/اء$/, 'ا');
    forms.add(core);
    for (const prefix of ['وال', 'بال', 'فال', 'لل', 'ال', 'و', 'ب', 'ف']) {
      if (core.startsWith(prefix) && core.length - prefix.length >= 2) {
        core = core.slice(prefix.length);
        forms.add(core);
        break;
      }
    }
  } else if (token.length > 3 && token.endsWith('s')) {
    forms.add(token.slice(0, -1));
  }
  return [...forms];
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t));
}

/** Distance d'édition avec inversion de deux lettres voisines (« tensoin » = « tension » à 1 près). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  const at = (i: number, j: number) => d[i]?.[j] ?? 0;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, at(i - 2, j - 2) + 1);
      (d[i] as number[])[j] = value;
    }
  }
  return at(a.length, b.length);
}

interface QueryIndex {
  forms: Set<string>;
  latin: string[];
}

function indexQuery(query: string): QueryIndex {
  const list = tokens(query);
  return { forms: new Set(list.flatMap(variants)), latin: list.filter((t) => !ARABIC_LETTER.test(t) && t.length >= 5) };
}

/** Poids d'un mot-clé trouvé dans la question (0 si absent) : nombre de mots ; une faute de frappe compte 1 (mot de 6 lettres et plus) ou 0,6. */
function keywordScore(keyword: string, q: QueryIndex): number {
  const words = tokens(keyword);
  if (!words.length) return 0;
  if (words.every((w) => variants(w).some((v) => q.forms.has(v)))) return words.length;
  if (words.length === 1) {
    const [word] = words;
    if (word && word.length >= 5 && !ARABIC_LETTER.test(word) && q.latin.some((t) => editDistance(t, word) === 1)) return word.length >= 6 ? 1 : 0.6;
  }
  return 0;
}

export function topicScore(topic: Topic, query: string): number {
  const q = indexQuery(query);
  const all = [...topic.keywords.fr, ...topic.keywords.ar, ...topic.keywords.darija];
  const score = all.reduce((sum, keyword) => sum + keywordScore(keyword, q), 0);
  return topic.urgent && score > 0 ? score * 2 + 1 : score;
}

/** Langue de la réponse : arabe si la question est écrite en lettres arabes (arabe ou darija), sinon la langue de l'écran. */
export function answerLanguage(query: string, uiLanguage: KbLanguage): KbLanguage {
  if (ARABIC_LETTER.test(query)) return 'ar';
  return uiLanguage;
}

export type SearchResult =
  | { kind: 'answer'; topic: Topic; lang: KbLanguage; related: Topic[] }
  | { kind: 'fallback'; lang: KbLanguage; suggestions: string[] };

/** Score minimal pour répondre (évite une réponse hors sujet sur un mot isolé mal reconnu). */
export const MIN_SCORE = 1;

export function search(kb: KnowledgeBase, query: string, uiLanguage: KbLanguage): SearchResult {
  const lang = answerLanguage(query, uiLanguage);
  const ranked = kb.topics
    .map((topic) => ({ topic, score: topicScore(topic, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < MIN_SCORE) {
    return { kind: 'fallback', lang, suggestions: kb.suggestions[lang].slice(0, 4) };
  }
  return { kind: 'answer', topic: best.topic, lang, related: ranked.slice(1, 3).map((r) => r.topic) };
}
