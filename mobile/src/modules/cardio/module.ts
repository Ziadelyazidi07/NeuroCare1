import type { ModuleDefinition } from '../types';

/** Module 5 : tension artérielle, alertes immédiates et automesure sur 3 jours (18 mesures), relevé PDF. */
export const cardioModule: ModuleDefinition = {
  id: 'cardio',
  title: 'Tension (HTA)',
  subtitle: 'Automesure 3 jours / 18 mesures',
  icon: 'heart',
  colour: '#00796B',
  route: '/modules/cardio',
};
