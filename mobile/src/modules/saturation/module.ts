import type { PlannedModule } from '../types';

export const saturationModule: PlannedModule = {
  id: 'saturation',
  title: 'Saturation SpO₂',
  subtitle: 'Oxygénation & pouls',
  icon: 'pulse',
  colour: '#C5221F',
  route: '/modules/saturation',
  description:
    "Noter les mesures de saturation en oxygène et de pouls relevées sur un oxymètre de doigt, et les partager avec l'aidant.",
  planned: [
    'Saisie guidée de la SpO₂ (%) et du pouls (battements par minute)',
    "Historique daté partagé avec l'aidant",
    'Conseil de contacter un professionnel de santé si une mesure sort des repères donnés par le médecin',
  ],
};
