/** Assistant Santé : l'adresse du serveur (même hôte, port 8089) sert seulement à mettre à jour la base de connaissances. */
import { getApiBase } from '../api/config';
import AssistantScreen from '../modules/assistant/AssistantScreen';

export default function AssistantRoute() {
  return <AssistantScreen loadApiBase={getApiBase} />;
}
