/**
 * Les 6 modules fonctionnels de NeuroCare, dans l'ordre de la grille d'accueil. Chaque module vit dans
 * son dossier et n'importe jamais un autre module (vérifié par les tests) : seuls `ui/`, `lib/`, `api/`
 * et ce dossier commun sont partagés.
 */
import { alzheimerModule } from './alzheimer/module';
import { cardioModule } from './cardio/module';
import { mentalModule } from './mental/module';
import { metabolicModule } from './metabolic/module';
import { observanceModule } from './observance/module';
import { saturationModule } from './saturation/module';
import type { ModuleDefinition } from './types';

export const MODULES: readonly ModuleDefinition[] = [observanceModule, saturationModule, mentalModule, metabolicModule, cardioModule, alzheimerModule];

export type { ModuleDefinition } from './types';
