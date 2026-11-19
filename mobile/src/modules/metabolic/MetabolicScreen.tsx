/** Écran dédié du module « metabolic » (indépendant des autres modules). */
import { PlannedModuleScreen } from '../PlannedModuleScreen';
import { metabolicModule } from './module';

export default function MetabolicScreen() {
  return <PlannedModuleScreen module={metabolicModule} />;
}
