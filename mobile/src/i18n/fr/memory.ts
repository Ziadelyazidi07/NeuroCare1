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
type Area = Domain | 'ORIENTATION';
type Prevention = 'TENSION_GLYCEMIE' | 'ACTIVITE' | 'SOMMEIL' | 'MIND' | 'STIMULATION' | 'SOCIAL' | 'AUDITION_VISION';

/** Module 6 — Alzheimer & Mémoire (observation des 4 A, jeu des 4 mots). */
const memory = {
  domains: {
    AMNESIE: { title: 'Amnésie', area: 'Mémoire récente' },
    APHASIE: { title: 'Aphasie', area: 'Langage' },
    APRAXIE: { title: 'Apraxie', area: 'Gestes et autonomie' },
    AGNOSIE: { title: 'Agnosie', area: 'Reconnaissance et repères' },
  } as Record<Domain, { title: string; area: string }>,
  questions: {
    OUBLIS_RECENTS: 'Oubliez-vous de façon répétée des événements récents (une visite, une conversation, le repas de la veille) ?',
    QUESTIONS_REPETEES: 'Vous arrive-t-il de poser plusieurs fois la même question dans la même heure ?',
    MANQUE_DU_MOT: 'Cherchez-vous souvent vos mots pour parler de choses courantes ?',
    PERIPHRASES: 'Remplacez-vous le nom d’un objet simple par une périphrase (« le truc pour écrire » au lieu de « stylo ») ?',
    GESTES_SIMPLES: 'Avez-vous une difficulté inhabituelle pour des gestes simples : lacer vos chaussures, fermer des boutons ?',
    OBJETS_USUELS: 'Avez-vous du mal à vous servir d’objets du quotidien que vous utilisiez sans peine (couverts, téléphone, télécommande) ?',
    OBJETS_FAMILIERS: 'Avez-vous du mal à reconnaître des objets familiers de votre maison ?',
    LIEUX_VISAGES: 'Vous êtes-vous perdu(e) dans un lieu habituel, ou avez-vous eu du mal à reconnaître le visage d’un proche ?',
  } as Record<Question, string>,
  /** Rappel court de chaque signe, pour la restitution. */
  questionShort: {
    OUBLIS_RECENTS: 'oublis d’événements récents',
    QUESTIONS_REPETEES: 'questions répétées',
    MANQUE_DU_MOT: 'mots difficiles à trouver',
    PERIPHRASES: 'périphrases à la place des noms d’objets',
    GESTES_SIMPLES: 'gestes simples devenus difficiles',
    OBJETS_USUELS: 'difficulté à utiliser les objets du quotidien',
    OBJETS_FAMILIERS: 'objets familiers mal reconnus',
    LIEUX_VISAGES: 'perte de repères dans un lieu connu ou visage d’un proche mal reconnu',
  } as Record<Question, string>,
  /** Fonction cognitive concernée (restitution et orientation médicale). */
  areas: {
    AMNESIE: 'la mémoire épisodique (souvenirs récents)',
    APHASIE: 'le langage (accès aux mots)',
    APRAXIE: 'les praxies (gestes du quotidien)',
    AGNOSIE: 'la reconnaissance et les repères visuo-spatiaux (objets, visages, lieux)',
    ORIENTATION: 'l’orientation dans le temps',
  } as Record<Area, string>,
  instructions:
    'Pensez aux dernières semaines et comparez à vos habitudes. Répondez vous-même ; un proche peut vous aider à répondre.',
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
  /** 7 axes de prévention des facteurs modifiables (OMS 2019, Commission Lancet 2024). */
  prevention: {
    TENSION_GLYCEMIE:
      'Tension et glycémie : visez une tension inférieure à 135/85 en automesure et une glycémie équilibrée ; faites le point avec les modules Tension HTA et Diabète de NeuroCare.',
    ACTIVITE: 'Activité physique : 150 minutes d’activité modérée par semaine, soit environ 30 minutes par jour (marche rapide, jardinage, vélo), adaptées à vos capacités.',
    SOMMEIL: 'Sommeil réparateur de 7 à 8 heures, à heures régulières ; signalez au médecin des ronflements avec pauses respiratoires.',
    MIND: 'Alimentation neuroprotectrice de type MIND / méditerranéen : huile d’olive, légumes verts à feuilles, poisson gras riche en oméga-3 1 à 2 fois par semaine, une poignée de noix, légumineuses ; limiter sucreries, fritures et charcuterie.',
    STIMULATION: 'Stimulation cognitive régulière : lecture, jeux de mots ou de cartes, apprendre quelque chose de nouveau (langue, recette, instrument).',
    SOCIAL: 'Vie sociale active : visites, repas en famille, appels, activités de groupe ou associatives.',
    AUDITION_VISION:
      'Audition et vue : faites-les contrôler et portez vos lunettes ou appareils auditifs ; une perte auditive non corrigée est l’un des principaux facteurs de risque modifiables.',
  } as Record<Prevention, string>,
  analysis: {
    noSign: 'Aucun des 8 signes des 4 A n’a été observé.',
    domain: (title: string, area: string, signs: string) => `${title}, ${area} : ${signs}.`,
    recallFull: 'Rappel des 4 mots : les 4 mots retrouvés spontanément.',
    recallAided: (free: number, recognised: number) => `Rappel des 4 mots : ${free} retrouvé(s) spontanément, ${recognised} retrouvé(s) avec l’aide des images.`,
    recallMissed: (free: number, missed: number) => `Rappel des 4 mots : ${free} retrouvé(s) spontanément, ${missed} non retrouvé(s) même avec les images.`,
    intruders: (n: number) => `${n} image(s) choisie(s) à tort lors de la reconnaissance.`,
    orientationOk: 'Orientation dans le temps : jour de la semaine retrouvé.',
    orientationWrong: 'Orientation dans le temps : jour de la semaine non retrouvé.',
    medicalAreas: (areas: string) => `Points qui méritent l’attention d’un médecin : ${areas}.`,
    medicalConsult:
      'Consultez votre médecin traitant avec ce bilan : il pourra réaliser un test cognitif standardisé (MMSE ou MoCA) et, si besoin, vous orienter vers une consultation mémoire ou un neurologue pour un bilan neuropsychologique complet.',
    medicalBiology:
      'Un bilan sanguin et clinique permet d’écarter des causes réversibles de troubles de la mémoire : carence en vitamine B12, hypothyroïdie, troubles du sommeil, dépression ou effet de certains médicaments (somnifères, anxiolytiques).',
    medicalBring: 'Venez si possible accompagné(e) d’un proche, avec la liste de vos médicaments.',
    reassure: 'Rien d’inhabituel n’est ressorti aujourd’hui. Refaites ce bilan dans 6 à 12 mois, ou plus tôt si vous ou vos proches remarquez un changement.',
    isolated: (areas: string) => `Un signe isolé concerne ${areas} : surveillez-le et parlez-en lors de votre prochaine consultation.`,
    priority: (text: string) => `Priorité pour vous · ${text}`,
  },
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
  findingsTitle: 'Ce que montrent vos réponses',
  medicalTitle: 'Orientation médicale (HAS, OMS, consultation mémoire)',
  practicalTitle: 'Conseils pratiques au quotidien',
  preventionTitle: 'Prévention personnalisée (OMS, Commission Lancet)',
  sources:
    'Sources : Commission Lancet sur la prévention de la démence (2024, 14 facteurs de risque modifiables) ; OMS, lignes directrices pour la réduction du risque de déclin cognitif et de démence (2019) ; HAS, parcours des personnes présentant des troubles neurocognitifs.',
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
    historyTitle: 'Historique enregistré sur le téléphone',
    historyColumns: ['Date', 'Indice', 'Détail'],
    summary: (signs: number, recall: number | null) => `${signs}/8 signes · ${recall === null ? 'sans exercice' : `rappel ${recall}/4`}`,
    noHistory: 'Aucun autre bilan.',
  },
  guide: {
    title: 'Avant de commencer',
    conditions: [
      'Passation au calme, sans bruit ni télévision.',
      'Avec vos lunettes et les appareils auditifs habituels, si vous en portez.',
      'Prenez votre temps : ce n’est pas un examen.',
    ],
  },
};

export default memory;
