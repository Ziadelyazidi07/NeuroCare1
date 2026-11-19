import type { ModuleDefinition } from '../types';

/** Module 2 : SpO2 et pouls au repos, alertes selon le profil respiratoire, relevé PDF. */
export const saturationModule: ModuleDefinition = {
  id: 'saturation',
  title: 'Saturation SpO₂',
  subtitle: 'Oxygénation & pouls',
  icon: 'pulse',
  colour: '#C5221F',
  route: '/modules/saturation',
};
