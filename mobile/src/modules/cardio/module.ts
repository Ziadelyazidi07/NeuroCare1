import type { ModuleDefinition } from '../types';

/** Module 5 : tension artérielle, alertes immédiates et automesure sur 3 jours (18 mesures), relevé PDF. */
export const cardioModule: ModuleDefinition = {
  id: 'cardio',
  icon: 'heart',
  colour: '#EF4444',
  tint: '#FEE2E2',
  route: '/modules/cardio',
};
