import type { ModuleDefinition } from '../types';

/** Module 2 : SpO2 et pouls au repos, alertes selon le profil respiratoire, relevé PDF. */
export const saturationModule: ModuleDefinition = {
  id: 'saturation',
  icon: 'pulse',
  colour: '#0EA5E9',
  tint: '#E0F2FE',
  route: '/modules/saturation',
};
