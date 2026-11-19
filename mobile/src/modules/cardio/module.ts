import type { PlannedModule } from '../types';

export const cardioModule: PlannedModule = {
  id: 'cardio',
  title: 'Tension (HTA)',
  subtitle: 'Automesure 3 jours / 18 mesures',
  icon: 'heart',
  colour: '#00796B',
  route: '/modules/cardio',
  description:
    "Suivre le protocole d'automesure tensionnelle : 3 jours, 3 mesures le matin et 3 le soir, soit 18 mesures.",
  planned: [
    'Rappels matin et soir pendant les 3 jours du protocole',
    'Saisie de la systolique, de la diastolique et du pouls pour chaque mesure',
    'Relevé des 18 mesures transmis au médecin',
  ],
};
