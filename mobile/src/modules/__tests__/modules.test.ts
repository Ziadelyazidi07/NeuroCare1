/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import { MODULES } from '..';
import { ar } from '../../i18n/ar';
import { fr } from '../../i18n/fr';

const modulesDir = path.join(__dirname, '..');
const appDir = path.join(modulesDir, '..', 'app');
const ids = MODULES.map((m) => m.id);

const filesOf = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesOf(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe('grille des modules', () => {
  it('présente les 6 modules dans l’ordre prévu', () => {
    expect(MODULES.map((m) => fr.home.modules[m.id].title)).toEqual([
      'Rappels & Suivi',
      'Saturation SpO₂',
      'Santé Mentale',
      'Diabète (FINDRISC)',
      'Tension (HTA)',
      'Alzheimer & Mémoire',
    ]);
  });

  it('traduit chaque tuile en arabe', () => {
    expect(MODULES.map((m) => ar.home.modules[m.id].title)).toEqual([
      'التذكيرات والمتابعة',
      'تشبّع الأكسجين SpO₂',
      'الصحة النفسية',
      'السكري (FINDRISC)',
      'ضغط الدم',
      'الزهايمر والذاكرة',
    ]);
  });

  it('donne à chaque tuile une icône et un fond pastel distincts', () => {
    expect(new Set(MODULES.map((m) => m.colour)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.tint)).size).toBe(MODULES.length);
  });

  it('ouvre le choix Senior / Aidant pour « Rappels & Suivi »', () => {
    expect(MODULES[0]?.route).toBe('/observance-role');
  });

  it('donne à chaque module un écran existant et distinct', () => {
    const routes = MODULES.map((m) => String(m.route));
    expect(new Set(routes).size).toBe(MODULES.length);
    for (const route of routes) {
      const file = path.join(appDir, `${route.slice(1)}.tsx`);
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('ouvre les 5 modules cliniques sans session, appairage ni serveur', () => {
    const clinical = ids.filter((id) => id !== 'observance').flatMap((id) => filesOf(path.join(modulesDir, id)));
    const shared = fs
      .readdirSync(modulesDir)
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => path.join(modulesDir, name));
    for (const file of [...clinical, ...shared]) {
      const source = fs.readFileSync(file, 'utf8');
      expect({ file: path.relative(modulesDir, file), dependsOnModule1: /\/(auth|api|senior|realtime)\//.test(source) }).toEqual({
        file: path.relative(modulesDir, file),
        dependsOnModule1: false,
      });
    }
  });

  it('garde chaque module indépendant des autres', () => {
    for (const id of ids) {
      const others = ids.filter((other) => other !== id);
      for (const file of filesOf(path.join(modulesDir, id))) {
        const source = fs.readFileSync(file, 'utf8');
        for (const other of others) {
          expect({ file: path.relative(modulesDir, file), importsOther: source.includes(`/${other}/`) }).toEqual({
            file: path.relative(modulesDir, file),
            importsOther: false,
          });
        }
      }
    }
  });
});
