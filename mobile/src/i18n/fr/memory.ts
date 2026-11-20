type Domain = 'AMNESIE' | 'APHASIE' | 'APRAXIE' | 'AGNOSIE';
type Question =
  | 'OUBLIS_RECENTS'
  | 'QUESTIONS_REPETEES'
  | 'MANQUE_DU_MOT'
  | 'PERIPHRASES'
  | 'GESTES_SIMPLES'
  | 'OBJETS_USUELS'
  | 'OBJETS_FAMILIERS'
  | 'LIEUX_VISAGES';
type Word = 'CLE' | 'CITRON' | 'HORLOGE' | 'OLIVIER';
type Thing = Word | 'POMME' | 'CISEAUX' | 'VELO' | 'PARAPLUIE' | 'LUNETTES' | 'POISSON' | 'ROSE' | 'TELEPHONE';
type Vigilance = 'RASSURANT' | 'SIGNES_A_SIGNALER';

/** Module 6 — Alzheimer & Mémoire (observation des 4 A, jeu des 4 mots). */
const memory = {
  domains: {
    AMNESIE: { title: 'Amnésie', area: 'Mémoire récente' },
    APHASIE: { title: 'Aphasie', area: 'Langage' },
    APRAXIE: { title: 'Apraxie', area: 'Gestes et autonomie' },
    AGNOSIE: { title: 'Agnosie', area: 'Reconnaissance et repères' },
  } as Record<Domain, { title: string; area: string }>,
  questions: {
    OUBLIS_RECENTS: 'La personne oublie-t-elle de façon répétée des événements récents (une visite, une conversation, le repas de la veille) ?',
    QUESTIONS_REPETEES: 'La personne pose-t-elle plusieurs fois la même question dans la même heure ?',
    MANQUE_DU_MOT: 'La personne cherche-t-elle souvent ses mots pour parler de choses courantes ?',
    PERIPHRASES: 'La personne remplace-t-elle le nom d’un objet simple par une périphrase (« le truc pour écrire » au lieu de « stylo ») ?',
    GESTES_SIMPLES: 'La personne a-t-elle une difficulté inhabituelle pour des gestes simples : lacer ses chaussures, fermer des boutons ?',
    OBJETS_USUELS:
      'La personne a-t-elle du mal à se servir d’objets du quotidien qu’elle utilisait sans peine (couverts, téléphone, télécommande) ?',
    OBJETS_FAMILIERS: 'La personne a-t-elle du mal à reconnaître des objets familiers de la maison ?',
    LIEUX_VISAGES: 'La personne s’est-elle perdue dans un lieu habituel, ou a-t-elle eu du mal à reconnaître le visage d’un proche ?',
  } as Record<Question, string>,
  instructions:
    'Pensez aux dernières semaines et comparez à ses habitudes. Les questions parlent de « la personne » : elles peuvent être remplies par elle-même ou par un proche.',
  lastWeeks: (question: string) => `Ces dernières semaines : ${question}`,
  sectionA: (domain: string, area: string) => `Section A : les 4 A · ${domain} (${area})`,
  things: {
    CLE: 'Clé',
    CITRON: 'Citron',
    HORLOGE: 'Horloge',
    OLIVIER: 'Olivier',
    POMME: 'Pomme',
    CISEAUX: 'Ciseaux',
    VELO: 'Vélo',
    PARAPLUIE: 'Parapluie',
    LUNETTES: 'Lunettes',
    POISSON: 'Poisson',
    ROSE: 'Rose',
    TELEPHONE: 'Téléphone',
  } as Record<Thing, string>,
  /** Formes acceptées au rappel libre (comparées sans accent, majuscule ni article). */
  forms: {
    CLE: ['cle', 'cles', 'clef', 'clefs'],
    CITRON: ['citron', 'citrons'],
    HORLOGE: ['horloge', 'horloges'],
    OLIVIER: ['olivier', 'oliviers'],
  } as Record<Word, string[]>,
  weekdays: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  calculation: 'Petit calcul : combien font 20 − 3 ?',
  vigilance: {
    RASSURANT: {
      title: 'Indice de vigilance cognitive : rassurant',
      short: 'Rassurant',
      message:
        'Aucun signe inhabituel n’est ressorti aujourd’hui. Bravo ! Continuez à entretenir votre mémoire au quotidien, et parlez-en à votre médecin si quelque chose change.',
    },
    SIGNES_A_SIGNALER: {
      title: 'Indice de vigilance cognitive : signes à signaler',
      short: 'Signes à signaler',
      message:
        'Certaines réponses méritent d’en parler à un professionnel. Ce n’est pas un diagnostic : beaucoup de causes (fatigue, stress, médicaments, carence, audition, humeur) peuvent jouer. Prenez rendez-vous avec votre médecin traitant, qui pourra orienter vers un neurologue ou une consultation mémoire pour un bilan neuropsychologique approfondi.',
    },
  } as Record<Vigilance, { title: string; short: string; message: string }>,
  reasons: {
    signs: (n: number) => `${n} signes observés sur les 8 questions des 4 A.`,
    domain: (domain: string) => `Les 2 signes du domaine ${domain} sont présents.`,
    recall: (n: number) => `${n} mot sur 4 retrouvé spontanément.`,
    missed: (n: number) => `${n} mot(s) ni retrouvé(s) ni reconnu(s) parmi les images.`,
    intruders: (n: number) => `${n} images choisies qui ne faisaient pas partie des mots.`,
    day: 'Jour de la semaine non retrouvé.',
  },
  prevention: [
    'Marcher 30 minutes par jour, en une ou plusieurs fois.',
    'Dormir environ 7 heures par nuit, à heures régulières.',
    'Garder des liens : appels, visites, repas en famille, activités de groupe ou associatives.',
    'Assiette de type MIND : huile d’olive, poisson 1 à 2 fois par semaine, une poignée de noix, fruits et légumes verts chaque jour ; limiter sucreries, fritures et charcuterie.',
    'Stimuler l’esprit : lecture, jeux de mots, cartes, apprentissage d’une activité nouvelle.',
    'Faire contrôler tension, glycémie, audition et vue, qui comptent aussi pour la mémoire.',
  ],
  domainTips: {
    AMNESIE: 'Mémoire : un agenda ou un calendrier bien visible, des routines fixes et un endroit unique pour les objets importants (clés, lunettes).',
    APHASIE: 'Langage : parler calmement, une idée à la fois, laisser le temps de trouver le mot sans le finir à sa place.',
    APRAXIE: 'Gestes : simplifier le quotidien (chaussures à scratch, vêtements faciles), décomposer les gestes et sécuriser la maison.',
    AGNOSIE: 'Repères : éclairer la maison, étiqueter les placards, éviter de sortir seul dans un lieu inconnu et garder sur soi un contact d’urgence.',
  } as Record<Domain, string>,
  screeningNotice:
    'Questionnaire d’observation et exercice de mémoire non validés comme test diagnostique : outil de pré-dépistage et d’aide à la consultation médicale. Seul un médecin peut interpréter ces éléments et décider d’un bilan.',
  introTitle: 'Bilan Mémoire & 4 A',
  intro:
    'Section A : 8 questions d’observation sur les dernières semaines (mémoire, langage, gestes, reconnaissance). Section B : un petit jeu de mémoire de 4 mots, sans chronomètre et sans piège. Comptez environ 5 minutes.',
  previous: 'Bilans précédents',
  none: 'Aucun bilan pour le moment.',
  historyDetail: (recall: number | null): string => (recall === null ? 'sans exercice' : `rappel ${recall}/4`),
  downloadThis: 'Télécharger ce bilan en PDF',
  download: 'Télécharger le bilan Mémoire & 4 A PDF',
  restart: 'Refaire le bilan',
  notSaved: 'Bilan non mémorisé sur ce téléphone (le résultat reste affiché).',
  learnTitle: 'Section B : jeu de mémoire (1/4)',
  learn: 'Lisez ces 4 mots à voix haute et prenez le temps de bien les retenir. Je vous les redemanderai dans un instant.',
  learned: 'J’ai retenu les 4 mots',
  skip: 'Passer le jeu de mémoire',
  pauseTitle: 'Section B : petite pause (2/4)',
  pause: 'Deux questions pour changer d’idée, sans pression.',
  dayQuestion: 'Quel jour de la semaine sommes-nous ?',
  continue: 'Continuer',
  recallTitle: 'Section B : rappel des mots (3/4)',
  recall: 'Quels étaient les 4 mots ? Écrivez (ou faites écrire) ceux dont vous vous souvenez, dans n’importe quel ordre.',
  recallField: 'Mots retrouvés',
  recallPlaceholder: 'Ex. : mot1, mot2…',
  validate: 'Valider mes mots',
  forgot: 'Je ne m’en souviens pas',
  recognitionTitle: 'Section B : reconnaissance (4/4)',
  recognition: 'Touchez les images des 4 mots appris tout à l’heure.',
  alreadyFound: (words: string) => ` Les mots déjà retrouvés (${words}) sont cochés.`,
  seeResult: 'Voir le résultat',
  domainsTitle: 'Résultats par domaine (4 A)',
  domainLine: (title: string, area: string, n: number) => `${title} (${area}) : ${n} signe${n > 1 ? 's' : ''} sur 2`,
  recallLine: (recalled: number, recognised: number) => `Rappel des mots : ${recalled} / 4 retrouvés, ${recognised} reconnu(s) en images.`,
  noExercise: 'Jeu de mémoire non réalisé.',
  tipsTitle: 'Conseils pour prendre soin de sa mémoire',
  pdf: {
    title: 'Bilan Mémoire & 4 A — pré-dépistage cognitif',
    dialog: 'Bilan Mémoire NeuroCare',
    session: (date: string) => `Bilan du ${date} (observations des dernières semaines)`,
    resultTitle: 'Résultat et orientation',
    fourATitle: 'Pré-dépistage des 4 A',
    fourAColumns: ['Domaine', 'Signes', 'Questions et réponses'],
    exerciseTitle: 'Exercice de mémoire (4 mots)',
    noExercise: 'Exercice de mémoire non réalisé lors de ce bilan.',
    wordsToLearn: 'Mots à retenir',
    freeRecall: 'Rappel libre',
    recognised: 'Reconnus parmi les images',
    missed: 'Ni retrouvés ni reconnus',
    intruders: 'Intrus choisis',
    orientation: 'Orientation (jour de la semaine)',
    calculation: 'Calcul simple (distraction)',
    correct: 'Correct',
    wrong: 'Erreur',
    none: 'aucun',
    wrongDay: (answered: string, actual: string) => `Répondu « ${answered} » (jour : ${actual})`,
    tipsTitle: 'Conseils pratiques',
    historyTitle: 'Historique enregistré sur le téléphone',
    historyColumns: ['Date', 'Indice', 'Détail'],
    summary: (signs: number, recall: number | null) => `${signs}/8 signes · ${recall === null ? 'sans exercice' : `rappel ${recall}/4`}`,
    noHistory: 'Aucun autre bilan.',
  },
};

export default memory;
