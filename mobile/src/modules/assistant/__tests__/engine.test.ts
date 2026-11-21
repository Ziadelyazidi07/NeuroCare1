/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import { answerLanguage, normalize, search } from '../engine';
import { EMBEDDED_KB, compareVersions, isKnowledgeBase, sourceLine } from '../knowledge';

const topicOf = (query: string, ui: 'fr' | 'ar' = 'fr') => {
  const result = search(EMBEDDED_KB, query, ui);
  return result.kind === 'answer' ? result.topic.id : 'fallback';
};

describe('base de connaissances embarquée', () => {
  it('est identique à celle du microservice assistant-service (même version, même contenu)', () => {
    const service = path.join(__dirname, '..', '..', '..', '..', '..', 'services', 'assistant-service', 'src', 'main', 'resources', 'knowledge', 'knowledge-base.json');
    expect(JSON.parse(fs.readFileSync(service, 'utf8'))).toEqual(EMBEDDED_KB);
  });

  it('couvre toutes les thématiques, chaque fiche sourcée OMS / HAS / ESC / FID et traduite', () => {
    expect(isKnowledgeBase(EMBEDDED_KB)).toBe(true);
    expect(new Set(EMBEDDED_KB.topics.map((t) => t.category))).toEqual(new Set(['observance', 'hta', 'diabete', 'spo2', 'memoire', 'mental', 'urgence']));
    for (const topic of EMBEDDED_KB.topics) {
      expect(topic.source.orgs.length).toBeGreaterThan(0);
      expect(topic.answer.ar).toMatch(/[؀-ۿ]/);
      if (topic.urgent) expect(topic.actions.filter((a) => a.type === 'call').map((a) => a.type === 'call' && a.number)).toEqual(['15', '141']);
    }
  });

  it('n’annonce jamais de diagnostic', () => {
    for (const topic of EMBEDDED_KB.topics) expect(topic.answer.fr).not.toMatch(/vous avez (un|une|le|la) |vous êtes atteint/i);
    expect(EMBEDDED_KB.disclaimer.fr).toMatch(/ne remplace jamais une consultation médicale/);
  });
});

describe('recherche locale trilingue', () => {
  it.each([
    ['نسيت الدوا', 'oubli-medicament'],
    ['طونسيو طالع', 'hta-elevee'],
    ['الطونسيو طالع', 'hta-elevee'],
    ['السكر', 'glycemie-elevee'],
    ['السكر طالع', 'glycemie-elevee'],
    ['عندي الدوخة', 'vertiges'],
    ['nsit dwa', 'oubli-medicament'],
    ['sokar hbet', 'hypoglycemie'],
    ['kifach n9is tension', 'hta-mesure'],
    ['J’ai oublié de prendre mon cachet ce matin', 'oubli-medicament'],
    ['Ma tension est à 16, c’est grave ?', 'hta-elevee'],
    ['tensoin elevee', 'hta-elevee'],
    ['j’ai mal à la poitrine', 'urgence-douleur-poitrine'],
    ['ma tension est haute et j’ai mal à la poitrine', 'urgence-douleur-poitrine'],
    ['son visage est déformé et son bras faible', 'urgence-avc'],
    ['الفم تعوج', 'urgence-avc'],
    ['je tremble et je transpire, sucre bas', 'hypoglycemie'],
    ['je dors mal la nuit', 'sommeil'],
    ['je me sens triste et seul', 'moral-tristesse'],
    ['أشعر بالحزن', 'moral-tristesse'],
    ['comment éviter le diabète', 'diabete-prevention'],
    ['vernis et oxymètre', 'spo2-mesure'],
  ])('« %s » → %s', (query, id) => {
    expect(topicOf(query)).toBe(id);
  });

  it.each([
    ['fr', 0, 'oubli-medicament'], ['fr', 1, 'hta-elevee'], ['fr', 2, 'hta-mesure'], ['fr', 3, 'vertiges'],
    ['fr', 4, 'hypoglycemie'], ['fr', 5, 'spo2-basse'], ['fr', 6, 'memoire-oublis'], ['fr', 7, 'sommeil'],
    ['ar', 0, 'oubli-medicament'], ['ar', 1, 'hta-elevee'], ['ar', 2, 'hta-mesure'], ['ar', 3, 'vertiges'],
    ['ar', 4, 'hypoglycemie'], ['ar', 5, 'spo2-basse'], ['ar', 6, 'memoire-oublis'], ['ar', 7, 'sommeil'],
    ['darija', 0, 'oubli-medicament'], ['darija', 1, 'hta-elevee'], ['darija', 2, 'glycemie-elevee'], ['darija', 3, 'vertiges'],
    ['darija', 4, 'sommeil'], ['darija', 5, 'urgence-douleur-poitrine'],
  ] as const)('puce %s n°%i → %s', (group, index, id) => {
    expect(topicOf(EMBEDDED_KB.suggestions[group][index] as string)).toBe(id);
  });

  it('dit honnêtement qu’il ne sait pas et propose des questions', () => {
    const result = search(EMBEDDED_KB, 'quel temps fera-t-il demain à Oujda ?', 'fr');
    expect(result).toEqual({ kind: 'fallback', lang: 'fr', suggestions: EMBEDDED_KB.suggestions.fr.slice(0, 4) });
  });

  it('répond en arabe à une question écrite en lettres arabes, même sur l’écran français', () => {
    expect(answerLanguage('نسيت الدوا', 'fr')).toBe('ar');
    expect(answerLanguage('ma tension', 'ar')).toBe('ar');
    expect(answerLanguage('ma tension', 'fr')).toBe('fr');
  });

  it('propose des fiches voisines', () => {
    const result = search(EMBEDDED_KB, 'ma tension est élevée, comment mesurer ma tension ?', 'fr');
    expect(result.kind === 'answer' && result.related.map((t) => t.category)).toContain('hta');
  });
});

describe('normalisation', () => {
  it('unifie accents, hamza, tâ marbûta, voyelles courtes et arabizi', () => {
    expect(normalize('Élevée !')).toBe('elevee');
    expect(normalize('أَنْسى الأشياءَ')).toBe('انسي الاشياء');
    expect(normalize('الدوخة')).toBe('الدوخه');
    expect(normalize('sokar tal3')).toBe('sokar tala');
    expect(normalize('180/110')).toBe('180 110');
  });
});

describe('versions et sources', () => {
  it('compare les versions segment par segment', () => {
    expect(compareVersions('2026.12.1', '2026.11.9')).toBeGreaterThan(0);
    expect(compareVersions('2026.11.1', '2026.11.1')).toBe(0);
    expect(compareVersions('2026.9', '2026.10')).toBeLessThan(0);
  });

  it('affiche la source dans la langue de la réponse', () => {
    const topic = EMBEDDED_KB.topics.find((t) => t.id === 'hta-elevee');
    if (!topic) throw new Error('fiche attendue');
    expect(sourceLine(EMBEDDED_KB, topic, 'fr')).toMatch(/^ESC · HAS — ESC, recommandations 2024/);
    expect(sourceLine(EMBEDDED_KB, topic, 'ar')).toMatch(/^الجمعية الأوروبية لأمراض القلب · الهيئة العليا للصحة — /);
  });
});

describe('indépendance du module', () => {
  it('n’importe ni le Module 1 (auth, api, senior, realtime) ni un autre module', () => {
    const dir = path.join(__dirname, '..');
    for (const name of fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      expect({ name, forbidden: /from '[^']*\/(auth|api|senior|realtime)\/|from '\.\.\/(observance|saturation|mental|metabolic|cardio|alzheimer)\//.test(source) }).toEqual({ name, forbidden: false });
    }
  });
});
