/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

import { MODULES } from '..';

const modulesDir = path.join(__dirname, '..');
const appDir = path.join(modulesDir, '..', 'app');
const ids = MODULES.map((m) => m.id);

const filesOf = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesOf(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });

describe('grille des modules', () => {
  it('présente les 5 modules dans l’ordre prévu', () => {
    expect(MODULES.map((m) => m.title)).toEqual([
      'Rappels & Suivi',
      'Saturation SpO₂',
      'Santé Mentale',
      'Diabète (FINDRISC)',
      'Tension (HTA)',
    ]);
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
