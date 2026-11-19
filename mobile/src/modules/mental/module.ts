import type { PlannedModule } from '../types';

export const mentalModule: PlannedModule = {
  id: 'mental',
  title: 'Santé Mentale',
  subtitle: 'Questionnaire Mini-GDS / GDS-15',
  icon: 'leaf',
  colour: '#7B1FA2',
  route: '/modules/mental',
  description:
    "Remplir avec le senior un court questionnaire sur son humeur (Mini-GDS ou GDS-15), pour préparer un échange avec son médecin.",
  planned: [
    'Questions lues à voix haute, réponses par « Oui » / « Non » en grands boutons',
    'Version courte (Mini-GDS, 4 questions) ou complète (GDS-15)',
    'Réponses transmises au médecin, qui seul les interprète',
  ],
};
