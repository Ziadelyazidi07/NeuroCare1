/**
 * Bouton « ← Accueil Modules » : revient à la grille des modules depuis n'importe quel écran, en
 * dépilant la navigation (pas d'empilement infini d'accueils). La flèche suit le sens de lecture.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { useLanguage } from '../i18n';
import { MIN_TOUCH, Text, colours as c, radius } from '../theme';

export function goToModules(): void {
  router.dismissTo('/');
}

type Props =
  /** Écrans aidant et modules : bouton pilule bleu pastel. */
  | { variant?: 'default' }
  /** En-tête de navigation : compact. */
  | { variant: 'header' }
  /** Espace senior : grande cible aux couleurs du thème senior. */
  | { variant: 'senior'; colours: { text: string; card: string }; font: number };

export function HomeButton(props: Props) {
  const { t, isRTL, row, start } = useLanguage();
  const variant = props.variant ?? 'default';
  const senior = props.variant === 'senior' ? props : null;
  const colour = senior ? senior.colours.text : c.primary;
  const size = senior ? senior.font : variant === 'header' ? 15 : 17;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.common.home}
      accessibilityHint={t.common.homeHint}
      hitSlop={variant === 'header' ? 8 : 0}
      onPress={goToModules}
      style={({ pressed }) => [
        variant === 'header' ? styles.header : [styles.button, start],
        row,
        senior && { minHeight: MIN_TOUCH, backgroundColor: senior.colours.card, borderColor: senior.colours.text, borderWidth: 2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={size + 4} color={colour} />
      <Text style={[styles.label, { color: colour, fontSize: size }]}>{t.common.home}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: c.primarySoft,
  },
  header: { alignItems: 'center', gap: 4, paddingVertical: 6 },
  label: { fontWeight: '700', flexShrink: 1 },
});
