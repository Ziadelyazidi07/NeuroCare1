import type { ModuleDefinition } from '../types';

/** Module 1 : rappels vocaux, « C'est fait », appairage et supervision temps réel (espaces senior et aidant). */
export const observanceModule: ModuleDefinition = {
  id: 'observance',
  title: 'Rappels & Suivi',
  subtitle: 'Observance des traitements — lien Senior / Aidant',
  icon: 'medkit',
  colour: '#0B57D0',
  route: '/observance-role',
};
