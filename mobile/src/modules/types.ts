import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';

/** Fiche d'un module fonctionnel, affichée en tuile sur la grille d'accueil. */
export interface ModuleDefinition {
  id: 'observance' | 'saturation' | 'mental' | 'metabolic' | 'cardio';
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Fond de la pastille d'icône (icône blanche, contraste ≥ 3:1). */
  colour: string;
  /** Écran d'entrée du module. */
  route: Href;
}

/** Contenu d'un écran de module encore en préparation. */
export interface PlannedModule extends ModuleDefinition {
  description: string;
  planned: string[];
}
