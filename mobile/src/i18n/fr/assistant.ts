type Status = 'embarquee' | 'a-jour' | 'mise-a-jour' | 'hors-ligne';
type Spoken = 'fr' | 'ar' | 'darija';

/** Assistant Santé & Orientation (chatbot vocal hors ligne). Les fiches de santé viennent de la base de connaissances. */
const assistant = {
  fab: 'Assistant Santé',
  fabA11y: 'Ouvrir l’Assistant Santé : posez une question de santé, en parlant ou en écrivant',
  title: 'Assistant Santé',
  subtitle: 'Informe et oriente, en français, en arabe et en darija',
  disclaimer:
    'L’Assistant Santé informe et oriente : il ne pose aucun diagnostic et ne remplace jamais une consultation médicale. En cas de signe grave, appelez le 15 ou le 141.',
  welcome: 'Bonjour ! Posez votre question en touchant le micro ou en l’écrivant, ou choisissez une question ci-dessous.',
  suggestions: 'Questions fréquentes',
  suggestionsDarija: 'Questions en darija',
  related: 'Voir aussi',
  inputLabel: 'Votre question',
  placeholder: 'Écrivez votre question…',
  send: 'Envoyer',
  mic: 'Touchez et parlez',
  micListening: 'Je vous écoute… Touchez pour terminer',
  micA11y: 'Poser ma question à voix haute',
  spokenLanguage: 'Je parle en :',
  spoken: { fr: 'Français', ar: 'العربية', darija: 'الدارجة' } as Record<Spoken, string>,
  micUnavailable: 'Micro indisponible dans cette version de l’application : touchez le champ de texte et utilisez le micro du clavier.',
  micDenied: 'Autorisez le micro dans les réglages du téléphone pour poser vos questions à voix haute.',
  micFailed: 'Je n’ai pas compris. Réessayez en parlant près du téléphone, ou écrivez votre question.',
  listen: 'Écouter',
  relisten: 'Réécouter',
  stopListening: 'Arrêter la lecture',
  autoRead: 'Lecture automatique des réponses',
  noVoice: 'Lecture vocale indisponible dans cette version de l’application.',
  you: 'Vous',
  bot: 'Assistant',
  source: (source: string) => `Source : ${source}`,
  urgent: 'Signe de gravité possible : appelez les urgences maintenant.',
  openModule: (name: string) => `Ouvrir « ${name} »`,
  knowledge: (version: string, status: string) => `Base de connaissances ${version} · ${status}`,
  status: {
    embarquee: '100 % hors ligne',
    'a-jour': 'à jour avec le serveur',
    'mise-a-jour': 'mise à jour depuis le serveur',
    'hors-ligne': 'serveur injoignable, fonctionne hors ligne',
  } as Record<Status, string>,
};

export default assistant;
