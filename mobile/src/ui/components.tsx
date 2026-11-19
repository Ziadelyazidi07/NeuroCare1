/** Composants partagés de l'espace aidant (le senior a ses propres composants, plus grands). */
import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PillColour } from '../lib/doses';
import { aidantColours as c, pillColours } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView> : <View style={styles.content}>{children}</View>}
    </SafeAreaView>
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? (
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || inactive) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? c.primary : c.primaryText} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && { color: c.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} style={styles.input} {...props} />
    </View>
  );
}

/** Champ de mot de passe avec un bouton œil pour l'afficher en clair ou le masquer. */
export function PasswordField({ label, ...props }: Omit<TextInputProps, 'secureTextEntry'> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          style={[styles.input, styles.passwordInput]}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          style={styles.eye}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={24} color={c.muted} />
        </Pressable>
      </View>
    </View>
  );
}

/** Case à cocher : l'état se lit aussi sans la couleur (coche et état d'accessibilité). */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkboxRow}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={18} color={c.primaryText} /> : null}
      </View>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

/** Pastille : couleur et libellé toujours ensemble (l'information ne repose jamais sur la couleur seule). */
export function Pill({ colour, label }: { colour: PillColour; label: string }) {
  return (
    <View style={styles.pill} accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: pillColours[colour] }]} />
      <Text style={[styles.pillText, { color: pillColours[colour] }]}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: c.card, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: c.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  text: { fontSize: 16, color: c.text },
  muted: { fontSize: 14, color: c.muted },
  button: { minHeight: 48, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
  buttonDanger: { backgroundColor: c.danger },
  buttonText: { color: c.primaryText, fontSize: 16, fontWeight: '600' },
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, color: c.text, backgroundColor: '#FFFFFF' },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  eye: { position: 'absolute', right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  checkboxRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: c.primary },
  error: { color: c.danger, fontSize: 15 },
  notice: { backgroundColor: c.warningBg, borderColor: c.warningBorder, borderWidth: 1, borderRadius: 10, padding: 12 },
  noticeText: { color: c.text, fontSize: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pillText: { fontSize: 14, fontWeight: '700' },
  loading: { padding: 32, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
