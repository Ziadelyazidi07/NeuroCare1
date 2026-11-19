/**
 * Bouton « ← Accueil Modules » : revient à la grille des modules depuis n'importe quel écran, en
 * dépilant la navigation (pas d'empilement infini d'accueils).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { MIN_TOUCH, aidantColours as c } from './theme';

export const HOME_LABEL = 'Accueil Modules';

export function goToModules(): void {
  router.dismissTo('/');
}

type Props =
  /** Écrans aidant et modules : bouton contour bleu. */
  | { variant?: 'default' }
  /** En-tête de navigation : compact. */
  | { variant: 'header' }
  /** Espace senior : grande cible aux couleurs du thème senior. */
  | { variant: 'senior'; colours: { text: string; card: string }; font: number };

export function HomeButton(props: Props) {
  const variant = props.variant ?? 'default';
  const senior = props.variant === 'senior' ? props : null;
  const colour = senior ? senior.colours.text : c.primary;
  const size = senior ? senior.font : variant === 'header' ? 14 : 16;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={HOME_LABEL}
      accessibilityHint="Revenir à la grille des modules NeuroCare"
      hitSlop={variant === 'header' ? 8 : 0}
      onPress={goToModules}
      style={({ pressed }) => [
        variant === 'header' ? styles.header : styles.button,
        senior && { minHeight: MIN_TOUCH, backgroundColor: senior.colours.card, borderColor: senior.colours.text },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name="grid-outline" size={size + 4} color={colour} />
      <Text style={[styles.label, { color: colour, fontSize: size }]}>← {HOME_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  label: { fontWeight: '700', flexShrink: 1 },
});
