type Level = 'FAIBLE' | 'LEGEREMENT_ACCRU' | 'MODERE' | 'ELEVE' | 'TRES_ELEVE';
type Family = 'AUCUN' | 'ELOIGNES' | 'PROCHES';
type Key =
  | 'age'
  | 'imc'
  | 'tourTaille'
  | 'activitePhysique'
  | 'fruitsLegumes'
  | 'medicamentsHypertension'
  | 'glycemieElevee'
  | 'antecedentsFamiliaux';
type FormError = 'AGE' | 'SEXE' | 'POIDS' | 'TAILLE' | 'TOUR' | 'INCOMPLET';

/** Module 4 — Diabète (FINDRISC). */
const findrisc = {
  formTitle: 'Questionnaire FINDRISC (8 questions)',
  age: '1. Âge (ans)',
  sex: 'Sexe',
  male: 'Homme',
  female: 'Femme',
  weight: '2. Poids (kg)',
  height: 'Taille (cm ou m)',
  heightPlaceholder: '168 ou 1,68',
  imc: (value: string) => `IMC calculé : ${value} kg/m²`,
  imcNone: 'IMC calculé : —',
  waist: '3. Tour de taille (cm, au niveau du nombril)',
  activity: '4. Au moins 30 minutes d’activité physique par jour (travail ou loisirs) ?',
  fruits: '5. Mange des fruits ou des légumes tous les jours ?',
  bpDrugs: '6. Prend régulièrement des médicaments contre l’hypertension artérielle ?',
  glucose: '7. Un taux de sucre élevé dans le sang a-t-il déjà été constaté (bilan, maladie, grossesse) ?',
  family: '8. Des membres de la famille ont-ils un diabète (type 1 ou 2) ?',
  familyOptions: {
    AUCUN: 'Non',
    ELOIGNES: 'Grand-parent, tante, oncle, cousin germain',
    PROCHES: 'Parent, frère, sœur, enfant',
  } as Record<Family, string>,
  submit: 'Calculer le score',
  score: (score: number, max: number) => `Score FINDRISC : ${score} / ${max}`,
  download: 'Télécharger le bilan FINDRISC PDF',
  newForm: 'Nouveau questionnaire',
  previous: 'Questionnaires précédents',
  none: 'Aucun questionnaire pour le moment.',
  downloadThis: 'Télécharger ce bilan en PDF',
  notSaved: 'Questionnaire non mémorisé sur ce téléphone (le résultat reste affiché).',
  level: {
    FAIBLE: { title: 'Risque faible', orientation: 'Continuez à bouger et à manger équilibré.' },
    LEGEREMENT_ACCRU: {
      title: 'Risque légèrement accru',
      orientation: 'Une activité physique régulière et une alimentation équilibrée aident à limiter ce risque.',
    },
    MODERE: { title: 'Risque modéré', orientation: 'Il est conseillé d’en parler à votre médecin.' },
    ELEVE: { title: 'Risque élevé', orientation: 'Un bilan sanguin (glycémie à jeun) est recommandé : parlez-en à votre médecin.' },
    TRES_ELEVE: { title: 'Risque très élevé', orientation: 'Une consultation médicale (médecin traitant ou endocrinologue) est fortement recommandée.' },
  } as Record<Level, { title: string; orientation: string }>,
  summary: (title: string, percent: number) => `${title} (environ ${percent} % de risque de diabète de type 2 à 10 ans)`,
  errors: {
    AGE: 'Âge : saisissez un nombre entre 18 et 120 ans.',
    SEXE: 'Indiquez le sexe (il fixe les seuils du tour de taille).',
    POIDS: 'Poids : saisissez une valeur entre 20 et 350 kg.',
    TAILLE: 'Taille : saisissez-la en cm (ex. 170) ou en m (ex. 1,70).',
    TOUR: 'Tour de taille : saisissez un nombre entier entre 40 et 200 cm.',
    INCOMPLET: 'Répondez aux 8 questions.',
  } as Record<FormError, string>,
  questionLabels: {
    age: 'Âge',
    imc: 'Indice de masse corporelle (IMC)',
    tourTaille: 'Tour de taille',
    activitePhysique: 'Au moins 30 minutes d’activité physique par jour',
    fruitsLegumes: 'Fruits ou légumes tous les jours',
    medicamentsHypertension: 'Médicaments contre l’hypertension pris régulièrement',
    glycemieElevee: 'Taux de sucre élevé dans le sang déjà constaté',
    antecedentsFamiliaux: 'Diabète dans la famille',
  } as Record<Key, string>,
  pdf: {
    title: 'Bilan FINDRISC — pré-dépistage du diabète de type 2',
    dialog: 'Bilan FINDRISC NeuroCare',
    session: (date: string) => `Questionnaire du ${date}`,
    measures: (weight: string, height: string) => `Poids : ${weight} kg · Taille : ${height} cm`,
    imc: 'IMC calculé',
    score: 'Score FINDRISC',
    resultTitle: 'Résultat et orientation',
    detailTitle: 'Détail des 8 réponses',
    columns: ['#', 'Question', 'Réponse', 'Points'],
    total: 'Total',
    years: (age: number) => `${age} ans`,
    imcAnswer: (imc: string, weight: string, height: string) => `${imc} kg/m² (poids ${weight} kg, taille ${height} cm)`,
    waistAnswer: (cm: number, male: boolean) => `${cm} cm (${male ? 'homme' : 'femme'})`,
    scoring:
      'Barème : moins de 7 points risque faible (1 %) ; 7 à 11 légèrement accru (4 %) ; 12 à 14 modéré (17 %) ; 15 à 20 élevé (33 %) ; plus de 20 très élevé (50 %). Risque estimé de diabète de type 2 à 10 ans.',
  },
  guide: {
    title: 'Mesurer poids, taille et tour de taille',
    device: 'Utilisez un pèse-personne, une toise (ou un mètre contre un mur) et un mètre ruban :',
    readings: [
      'Poids : sur le pèse-personne, en tenue légère, sans chaussures.',
      'Taille : debout, dos et talons contre le mur, sans chaussures.',
      'Tour de taille : mètre ruban horizontal au niveau du nombril, sans serrer, en fin d’expiration.',
    ],
    pharmacy: 'Sans appareil : la pharmacie peut vous peser et mesurer votre taille et votre tour de taille.',
    conditions: [
      'Glycémie capillaire (lecteur et bandelette) : notez toujours si elle est faite à jeun (au moins 8 h sans manger) ou 2 heures après le début du repas.',
    ],
  },
};

export default findrisc;
