/** Écran dédié du module « cardio » (indépendant des autres modules). */
import { PlannedModuleScreen } from '../PlannedModuleScreen';
import { cardioModule } from './module';

export default function CardioScreen() {
  return <PlannedModuleScreen module={cardioModule} />;
}
