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
type FormError = 'AGE' | 'SEXE' | 'POIDS' | 'TAILLE' | 'TOUR' | 'INCOMPLET' | 'SIGNES';
type Symptom = 'URINES' | 'SOIF' | 'FATIGUE' | 'BOUCHE_SECHE' | 'VISION' | 'FAIM' | 'AMAIGRISSEMENT';
type Alert = 'UN_SIGNE' | 'PLUSIEURS' | 'TRIADE';

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
  symptomsTitle: 'Partie 2 : signes cliniques d’alerte (symptômes d’hyperglycémie)',
  symptomsIntro:
    'Ces 7 questions ne modifient pas le score FINDRISC sur 26 : elles repèrent des signes qui, s’ils sont présents, justifient de consulter rapidement.',
  symptomQuestion: (n: number, title: string, question: string) => `${n}. ${title} : ${question}`,
  symptoms: {
    URINES: {
      title: 'Urines fréquentes',
      question: 'Avez-vous besoin d’uriner beaucoup plus souvent que d’habitude, notamment 2 fois ou plus par nuit, alors que ce n’est pas habituel ?',
    },
    SOIF: {
      title: 'Soif intense',
      question: 'Avez-vous besoin de boire constamment, nettement plus que d’habitude (par exemple plus de 3 litres par jour) ?',
    },
    FATIGUE: { title: 'Fatigue inhabituelle', question: 'Ressentez-vous une fatigue persistante qui gêne vos activités quotidiennes ?' },
    BOUCHE_SECHE: { title: 'Bouche sèche', question: 'Avez-vous une sensation permanente de bouche sèche malgré la prise d’eau ?' },
    VISION: { title: 'Vision floue', question: 'Votre vision est-elle devenue trouble récemment ?' },
    FAIM: { title: 'Faim excessive', question: 'Avez-vous faim de façon répétée malgré des repas habituels ?' },
    AMAIGRISSEMENT: {
      title: 'Amaigrissement inexpliqué',
      question: 'Vos vêtements sont-ils devenus plus larges, ou avez-vous perdu du poids sans faire de régime ?',
    },
  } as Record<Symptom, { title: string; question: string }>,
  alert: {
    UN_SIGNE: {
      title: 'Signe clinique à signaler au médecin',
      message:
        'Un signe évocateur d’hyperglycémie est présent. Isolé, il peut avoir d’autres causes : parlez-en à votre médecin, qui pourra prescrire un dosage de la glycémie à jeun ou de l’HbA1c.',
    },
    PLUSIEURS: {
      title: 'Alerte clinique prioritaire : symptômes évocateurs d’hyperglycémie',
      message:
        'Plusieurs signes évocateurs d’hyperglycémie sont présents, quel que soit le score FINDRISC. Consultez un médecin rapidement (dans les prochains jours) pour un dosage de la glycémie à jeun et de l’HbA1c.',
    },
    TRIADE: {
      title: 'Alerte clinique prioritaire : urines fréquentes, soif intense et amaigrissement',
      message:
        'Cette association est très évocatrice d’une hyperglycémie. Consultez un médecin sans attendre (sous 24 à 48 heures) pour une glycémie à jeun et une HbA1c. En cas de vomissements, douleurs au ventre, respiration rapide ou somnolence : appelez immédiatement les urgences.',
    },
  } as Record<Alert, { title: string; message: string }>,
  symptomsPresent: (list: string) => `Signes présents : ${list}.`,
  historySigns: (n: number) => ` · ${n} signe${n > 1 ? 's' : ''} d’alerte`,
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
    INCOMPLET: 'Répondez aux 8 questions FINDRISC.',
    SIGNES: 'Répondez aux 7 questions de la partie 2 (signes cliniques d’alerte).',
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
    symptomsTitle: 'Partie 2 — Signes cliniques d’alerte (hors score FINDRISC)',
    symptomsColumns: ['#', 'Signe', 'Réponse'],
    symptomsCount: (n: number) => `${n} signe(s) présent(s) sur 7`,
    symptomsNone: 'Aucun signe clinique d’alerte signalé.',
    symptomsNotRecorded: 'Partie 2 non renseignée (questionnaire antérieur à son ajout).',
    years: (age: number) => `${age} ans`,
    imcAnswer: (imc: string, weight: string, height: string) => `${imc} kg/m² (poids ${weight} kg, taille ${height} cm)`,
    waistAnswer: (cm: number, male: boolean) => `${cm} cm (${male ? 'homme' : 'femme'})`,
    scoring:
      'Barème : moins de 7 points risque faible (1 %) ; 7 à 11 légèrement accru (4 %) ; 12 à 14 modéré (17 %) ; 15 à 20 élevé (33 %) ; plus de 20 très élevé (50 %). Risque estimé de diabète de type 2 à 10 ans (barème officiel FINDRISC, repris par la HAS et la Fédération Française des Diabétiques).',
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
