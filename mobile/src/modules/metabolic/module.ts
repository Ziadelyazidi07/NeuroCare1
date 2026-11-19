import type { PlannedModule } from '../types';

export const metabolicModule: PlannedModule = {
  id: 'metabolic',
  title: 'Diabète (FINDRISC)',
  subtitle: 'Pré-dépistage & glycémie',
  icon: 'water',
  colour: '#B05A00',
  route: '/modules/metabolic',
  description:
    'Remplir le questionnaire de pré-dépistage FINDRISC et tenir un carnet de glycémies, à montrer au médecin.',
  planned: [
    'Questionnaire FINDRISC (âge, tour de taille, activité, alimentation, antécédents)',
    'Carnet de glycémies daté (à jeun, après repas)',
    'Synthèse imprimable pour la consultation',
  ],
};
