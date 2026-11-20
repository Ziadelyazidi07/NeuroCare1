type Level = 'VERT' | 'ORANGE' | 'ROUGE';

/** Module 2 — Saturation SpO2. */
const spo2 = {
  profileTitle: 'Profil respiratoire',
  profileQuestion: 'Le patient souffre-t-il d’une maladie respiratoire chronique connue (ex : BPCO, insuffisance respiratoire) ?',
  profileHelp: 'Oui : cible 88-92 % (BPCO, insuffisance respiratoire). Non : cible standard 95-100 %.',
  profileLabel: (chronic: boolean): string => (chronic ? 'BPCO / insuffisance respiratoire (cible 88-92 %)' : 'Standard (cible 95-100 %)'),
  newMeasure: 'Nouvelle mesure au repos',
  measureHelp: 'Patient assis, au calme depuis 5 minutes, main au chaud, sans vernis sur le doigt mesuré.',
  spo2Field: 'SpO2 (%)',
  pulseField: 'Pouls (bpm)',
  bpm: 'bpm',
  save: 'Enregistrer la mesure',
  noMeasure: 'Aucune mesure pour le moment.',
  measureLine: (spo2: number, pulse: number) => `SpO2 ${spo2} % · Pouls ${pulse} bpm`,
  level: { VERT: 'Vert', ORANGE: 'Orange', ROUGE: 'Rouge' } as Record<Level, string>,
  download: 'Télécharger le relevé SpO2 PDF',
  orientation:
    'Orientation : en cas d’essoufflement important, de douleur thoracique, de lèvres bleutées ou de confusion, appelez les urgences (15 ou 141) quelle que soit la mesure.',
  advice: (level: Level, chronic: boolean): { title: string; message: string } => {
    if (level === 'ROUGE') {
      return {
        title: 'Urgence : manque d’oxygène critique',
        message: `Saturation en dessous de ${chronic ? 85 : 90} %. Appelez immédiatement les urgences (15 ou 141) et restez auprès du patient.`,
      };
    }
    if (level === 'ORANGE') {
      return chronic
        ? {
            title: 'Alerte : hors de la cible 88-92 %',
            message:
              'Faites reposer le patient, vérifiez le capteur (doigt froid, vernis à ongles, position) et recontrôlez dans 10 minutes. Si la valeur reste hors cible, contactez le médecin qui le suit.',
          }
        : {
            title: 'Alerte : saturation basse (90-94 %)',
            message:
              'Faites reposer le patient, vérifiez le capteur (doigt froid, vernis à ongles, position) et recontrôlez dans 10 minutes. Si la valeur reste basse, contactez un médecin.',
          };
    }
    return chronic
      ? { title: 'Dans la cible (88-92 %)', message: 'La saturation est dans la cible recommandée pour une maladie respiratoire chronique.' }
      : { title: 'Oxygénation normale (95-100 %)', message: 'La saturation est dans la zone habituelle au repos.' };
  },
  errors: {
    spo2: (min: number, max: number) => `SpO2 : saisissez un nombre entier entre ${min} et ${max} %.`,
    pulse: (min: number, max: number) => `Pouls : saisissez un nombre entier entre ${min} et ${max} bpm.`,
    profileNotSaved: 'Profil non mémorisé sur ce téléphone.',
    measureNotSaved: 'Mesure non mémorisée sur ce téléphone.',
  },
  pdf: {
    title: 'Relevé de saturation en oxygène (SpO2)',
    dialog: 'Relevé SpO2 NeuroCare',
    profile: 'Profil respiratoire actuel',
    counts: (measures: number, alerts: number) => `Mesures : ${measures} · Alertes : ${alerts}`,
    historyTitle: 'Historique des mesures (au repos)',
    columns: ['Date / heure', 'SpO2', 'Pouls', 'Profil', 'Niveau'],
    level: { VERT: 'Vert', ORANGE: 'Alerte orange', ROUGE: 'Alerte rouge' } as Record<Level, string>,
    none: 'Aucune mesure enregistrée.',
    alertsTitle: 'Alertes et orientation',
    noAlerts: 'Aucune alerte sur la période.',
  },
  guide: {
    title: 'Bien mesurer la saturation',
    device: 'Utilisez un oxymètre de pouls : une petite pince qui se clipse au bout du doigt. Recopiez les 2 chiffres de l’écran :',
    readings: [
      'SpO₂ → champ SpO2 (%)',
      'PR → champ Pouls (bpm)',
    ],
    pharmacy: 'Pas d’oxymètre ? Demandez une mesure de la saturation en pharmacie.',
    conditions: [
      'Au repos complet depuis 5 minutes.',
      'Doigt propre, sec et réchauffé.',
      'Sans vernis à ongles ni faux ongles.',
    ],
  },
};

export default spo2;
