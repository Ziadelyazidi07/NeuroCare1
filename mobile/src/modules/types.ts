import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';

export type ModuleId = 'observance' | 'saturation' | 'mental' | 'metabolic' | 'cardio' | 'alzheimer';

/** Fiche d'un module fonctionnel, affichée en carte sur la grille d'accueil (titre et sous-titre : `t.home.modules`). */
export interface ModuleDefinition {
  id: ModuleId;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Couleur de l'icône (accent du module). */
  colour: string;
  /** Fond pastel du badge d'icône. */
  tint: string;
  /** Écran d'entrée du module. */
  route: Href;
}
