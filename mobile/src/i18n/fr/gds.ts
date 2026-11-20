type Code =
  | 'MINI_DECOURAGE'
  | 'GDS_01' | 'GDS_02' | 'GDS_03' | 'GDS_04' | 'GDS_05' | 'GDS_06' | 'GDS_07' | 'GDS_08'
  | 'GDS_09' | 'GDS_10' | 'GDS_11' | 'GDS_12' | 'GDS_13' | 'GDS_14' | 'GDS_15';
type Level = 'INDICE_NORMAL' | 'LEGERE_A_MODEREE' | 'SEVERE';

/** Module 3 — Santé mentale (Mini-GDS / GDS-15). */
const gds = {
  questions: {
    MINI_DECOURAGE: 'Vous sentez-vous souvent découragé(e) et triste ?',
    GDS_01: 'Êtes-vous dans l’ensemble satisfait(e) de votre vie ?',
    GDS_02: 'Avez-vous renoncé à un grand nombre de vos activités et de vos centres d’intérêt ?',
    GDS_03: 'Avez-vous le sentiment que votre vie est vide ?',
    GDS_04: 'Vous ennuyez-vous souvent ?',
    GDS_05: 'Êtes-vous de bonne humeur la plupart du temps ?',
    GDS_06: 'Avez-vous peur qu’il vous arrive quelque chose de mauvais ?',
    GDS_07: 'Êtes-vous heureux(se) la plupart du temps ?',
    GDS_08: 'Vous sentez-vous souvent faible et sans recours ?',
    GDS_09: 'Préférez-vous rester chez vous plutôt que de sortir et faire de nouvelles choses ?',
    GDS_10: 'Pensez-vous avoir plus de problèmes de mémoire que la plupart des gens ?',
    GDS_11: 'Pensez-vous qu’il est merveilleux de vivre à notre époque ?',
    GDS_12: 'Vous sentez-vous plutôt inutile tel(le) que vous êtes maintenant ?',
    GDS_13: 'Vous sentez-vous plein(e) d’énergie ?',
    GDS_14: 'Avez-vous le sentiment que votre situation est désespérée ?',
    GDS_15: 'Pensez-vous que la situation de la plupart des gens est meilleure que la vôtre ?',
  } as Record<Code, string>,
  instructions: 'Répondez par Oui ou par Non en pensant à ce que vous avez ressenti au cours des 7 derniers jours.',
  level: {
    INDICE_NORMAL: {
      title: 'Indice normal — absence probable de dépression',
      orientation: 'Aucun signe évocateur relevé par ce questionnaire. Refaites-le si l’humeur change.',
    },
    LEGERE_A_MODEREE: {
      title: 'Indicateurs compatibles avec une dépression légère à modérée',
      orientation: 'Il est conseillé d’en parler à un médecin traitant ou à un psychologue.',
    },
    SEVERE: {
      title: 'Indicateurs compatibles avec une dépression sévère',
      orientation:
        'Une consultation médicale est recommandée rapidement. En cas d’idées noires ou de détresse, appelez sans attendre le 15 ou le 141.',
    },
  } as Record<Level, { title: string; orientation: string }>,
  stoppedTitle: 'Absence probable de dépression (Mini-GDS à 0)',
  step1: 'Étape 1 : Mini-GDS',
  step2: 'Étape 2 : questions complémentaires (GDS-15)',
  miniScore: (score: number) => `Score Mini-GDS : ${score} / 4`,
  gdsScore: (score: number) => `Score GDS-15 : ${score} / 15`,
  download: 'Télécharger le rapport GDS PDF',
  restart: 'Refaire le questionnaire',
  introTitle: 'Questionnaire sur l’humeur',
  intro:
    'Quelques questions sur l’état émotionnel des 7 derniers jours. Étape 1 : 4 questions (Mini-GDS). Si une réponse le justifie, l’étape 2 complète avec les questions de la GDS-15.',
  previous: 'Passations précédentes',
  none: 'Aucune passation pour le moment.',
  historyScore: (mini: number, gds15: number | null) => (gds15 === null ? `Mini-GDS ${mini}/4` : `GDS-15 ${gds15}/15`),
  notSaved: 'Questionnaire non mémorisé sur ce téléphone (le résultat reste affiché).',
  pdf: {
    title: 'Rapport GDS — santé mentale (Mini-GDS / GDS-15)',
    dialog: 'Rapport GDS NeuroCare',
    session: (date: string) => `Passation du ${date} (état émotionnel des 7 derniers jours)`,
    miniScore: 'Score Mini-GDS',
    gdsScore: 'Score GDS-15',
    notDone: 'non réalisé (Mini-GDS à 0, arrêt du test)',
    resultTitle: 'Résultat et orientation',
    answersTitle: 'Questions et réponses',
    columns: ['#', 'Échelle', 'Question', 'Réponse', 'Point'],
    scale: (step: 1 | 2): string => (step === 1 ? 'Mini-GDS' : 'GDS-15'),
    scoring:
      'Barème GDS-15 : 0-4 indice normal ; 5-9 indicateurs compatibles avec une dépression légère à modérée ; 10-15 indicateurs compatibles avec une dépression sévère. Items comptés sur « Non » : satisfaction de vie, bonne humeur, heureux, merveilleux de vivre, plein d’énergie.',
  },
  guide: {
    title: 'Avant de commencer',
    conditions: [
      'Installez-vous au calme, sans bruit ni interruption.',
      'Répondez en repensant à ce que vous avez ressenti au cours des 7 derniers jours.',
      'Il n’y a pas de bonne ou de mauvaise réponse : répondez simplement par oui ou par non.',
    ],
  },
};

export default gds;
