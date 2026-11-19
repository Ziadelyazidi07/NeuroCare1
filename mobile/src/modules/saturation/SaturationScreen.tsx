/** Écran dédié du module « saturation » (indépendant des autres modules). */
import { PlannedModuleScreen } from '../PlannedModuleScreen';
import { saturationModule } from './module';

export default function SaturationScreen() {
  return <PlannedModuleScreen module={saturationModule} />;
}
