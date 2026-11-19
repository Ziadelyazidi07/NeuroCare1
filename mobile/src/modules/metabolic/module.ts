import type { ModuleDefinition } from '../types';

/** Module 4 : pré-dépistage du diabète de type 2 (score FINDRISC sur 26), bilan PDF. */
export const metabolicModule: ModuleDefinition = {
  id: 'metabolic',
  title: 'Diabète (FINDRISC)',
  subtitle: 'Pré-dépistage & glycémie',
  icon: 'water',
  colour: '#B05A00',
  route: '/modules/metabolic',
};
