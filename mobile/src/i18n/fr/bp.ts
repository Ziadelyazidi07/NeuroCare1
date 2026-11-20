type Level = 'URGENCE_HYPERTENSIVE' | 'HYPOTENSION' | 'TENSION_ELEVEE' | 'NORMALE';
type Moment = 'MATIN' | 'SOIR';
type Symptom = 'MAUX_DE_TETE' | 'POITRINE' | 'ESSOUFFLEMENT' | 'PAROLE_VISION';
type BpError = 'TAS' | 'TAD' | 'ORDRE' | 'POULS';

/** Module 5 — Tension (HTA). */
const bp = {
  mmHg: 'mmHg',
  bpm: 'bpm',
  errors: {
    TAS: 'Systolique (TAS, le grand chiffre) : entre 60 et 260 mmHg.',
    TAD: 'Diastolique (TAD, le petit chiffre) : entre 30 et 160 mmHg.',
    ORDRE: 'La systolique (grand chiffre) doit être supérieure à la diastolique.',
    POULS: 'Pouls : entre 30 et 220 battements par minute.',
  } as Record<BpError, string>,
  elderlyNote: 'Note : après 80 ans, une systolique jusqu’à 140-145 mmHg peut être tolérée selon l’avis du médecin.',
  advice: {
    URGENCE_HYPERTENSIVE: {
      title: 'Alerte rouge : tension très élevée (≥ 180/110)',
      message:
        'Restez au calme, assis. Vérifiez les symptômes ci-dessous : au moindre symptôme, appelez immédiatement le 15 ou le 141. Sans symptôme, refaites une mesure dans 5 minutes et contactez rapidement un médecin.',
    },
    HYPOTENSION: {
      title: 'Alerte orange : tension basse (TAS < 100)',
      message:
        'Risque de malaise et de chute : allongez-vous, buvez un verre d’eau, puis relevez-vous lentement en vérifiant que la position debout est bien supportée. Signalez-le au médecin si cela se répète.',
    },
    TENSION_ELEVEE: {
      title: 'Vigilance : valeurs compatibles avec une HTA modérée (135-179 / 85-109)',
      message:
        'Une mesure isolée ne suffit pas : suivez le protocole d’automesure sur 3 jours pour un relevé fiable, et limitez le sel en attendant l’avis du médecin.',
    },
    NORMALE: { title: 'Tension normale (< 135/85)', message: 'Les valeurs sont dans la zone habituelle à domicile.' },
  } as Record<Level, { title: string; message: string }>,
  badge: { URGENCE_HYPERTENSIVE: 'Urgence', HYPOTENSION: 'Basse', TENSION_ELEVEE: 'Vigilance', NORMALE: 'Normale' } as Record<Level, string>,
  symptoms: {
    MAUX_DE_TETE: 'Maux de tête violents',
    POITRINE: 'Douleur dans la poitrine',
    ESSOUFFLEMENT: 'Essoufflement',
    PAROLE_VISION: 'Trouble de la parole ou de la vision',
  } as Record<Symptom, string>,
  symptomsQuestion: 'Le patient ressent-il l’un de ces symptômes ?',
  symptomPresent: 'Symptôme présent : appelez immédiatement les urgences.',
  moment: { MATIN: 'Matin', SOIR: 'Soir' } as Record<Moment, string>,
  short: (rang: number) => `M${rang}`,
  slotLabel: (jour: number, moment: string, rang: number) => `Jour ${jour} · ${moment} · M${rang}`,
  instructions: [
    'Assis, dos appuyé, bras posé sur la table, brassard à hauteur du cœur, après 5 minutes de repos.',
    'Matin : avant le petit-déjeuner et avant la prise des médicaments.',
    'Soir : avant le coucher.',
    'À chaque fois, 3 mesures (M1, M2, M3) espacées de 1 à 2 minutes.',
  ],
  protocolTitle: 'Automesure sur 3 jours (18 mesures)',
  averageComplete: (avg: string) => `Moyenne des 18 mesures : ${avg}`,
  averagePartial: (count: number, total: number, avg: string) => `Moyenne provisoire (${count}/${total}) : ${avg}`,
  averageElevated: 'Moyenne ≥ 135/85 mmHg : montrez ce relevé tensionnel à votre médecin.',
  averageNormal: 'Moyenne inférieure à 135/85 mmHg.',
  entry: (label: string, day: string) => `Saisie : ${label} (${day})`,
  saveSlot: (label: string) => `Enregistrer ${label}`,
  start: 'Démarrer le protocole (jour 1 = aujourd’hui)',
  startNew: 'Démarrer un nouveau protocole (jour 1 = aujourd’hui)',
  download: 'Télécharger le relevé d’automesure HTA PDF',
  spotTitle: 'Mesure ponctuelle',
  saveMeasure: 'Enregistrer la mesure',
  lastMeasures: 'Dernières mesures',
  tas: 'TAS (grand chiffre)',
  tad: 'TAD (petit chiffre)',
  pulse: 'Pouls (bpm)',
  alertValue: (label: string, tas: number, tad: number, pulse: number) => `${label} : ${tas}/${tad} mmHg · ${pulse} bpm`,
  historyLine: (tas: number, tad: number, pulse: number) => `${tas}/${tad} · ${pulse} bpm`,
  saving: 'Enregistrement en cours ou impossible.',
  rest: (time: string) => `Repos : ${time}`,
  stopTimer: 'Arrêter le minuteur',
  rest1: 'Repos 1 min',
  rest2: 'Repos 2 min',
  gridDay: (jour: number, date: string) => `Jour ${jour} · ${date}`,
  cellA11y: (label: string, tas: number | null, tad: number | null) => (tas === null ? `${label} : à saisir` : `${label} : ${tas} sur ${tad}`),
  measureNotSaved: 'Mesure non mémorisée sur ce téléphone.',
  protocolNotCreated: 'Protocole non créé sur ce téléphone.',
  pdf: {
    title: 'Relevé d’automesure tensionnelle (HTA)',
    dialog: 'Relevé d’automesure HTA NeuroCare',
    started: (date: string) => `Protocole d’automesure commencé le ${date} (3 jours consécutifs, 3 mesures le matin et 3 le soir)`,
    average: (count: number, size: number) => `Moyenne de ${count} mesure${count > 1 ? 's' : ''} sur ${size}`,
    pulse: (value: string) => `pouls ${value} bpm`,
    noMeasure: 'Aucune mesure saisie.',
    elevated: 'Moyenne supérieure ou égale à 135/85 mmHg : montrez ce relevé à votre médecin.',
    complete: 'Moyenne inférieure à 135/85 mmHg sur les 18 mesures.',
    partial: 'Protocole incomplet : la moyenne est provisoire.',
    orientationTitle: 'Orientation',
    tableTitle: 'Relevé complet (TAS/TAD en mmHg, pouls)',
    columns: ['Jour', 'Moment', 'M1', 'M2', 'M3'],
    day: (jour: number, date: string) => `Jour ${jour} (${date})`,
    alertsTitle: 'Alertes',
    noAlerts: 'Aucune alerte.',
  },
  guide: {
    title: 'Bien mesurer sa tension',
    device: 'Utilisez un tensiomètre électronique au bras, brassard enroulé autour du bras nu. Recopiez les 3 chiffres de l’écran dans les bons champs :',
    readings: [
      'SYS → TAS (grand chiffre)',
      'DIA → TAD (petit chiffre)',
      'PUL → Pouls (battements par minute)',
    ],
    pharmacy: 'Pas de tensiomètre ? Allez mesurer votre tension en pharmacie et notez les 3 chiffres SYS, DIA et PUL.',
    conditions: [
      'Rester assis au calme 5 minutes avant la mesure, dos appuyé, sans parler.',
      'Bras posé sur la table, brassard à hauteur du cœur.',
      'Le matin : avant le petit-déjeuner et avant la prise des médicaments.',
    ],
  },
};

export default bp;
