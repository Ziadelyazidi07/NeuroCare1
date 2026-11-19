/** Écran dédié du module « mental » (indépendant des autres modules). */
import { PlannedModuleScreen } from '../PlannedModuleScreen';
import { mentalModule } from './module';

export default function MentalScreen() {
  return <PlannedModuleScreen module={mentalModule} />;
}
