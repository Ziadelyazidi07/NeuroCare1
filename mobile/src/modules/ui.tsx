/** Composants communs aux modules de pré-dépistage (aucune logique propre à un module). */
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useLanguage } from '../i18n';
import { MIN_TOUCH, Text, colours as c, font, radius } from '../theme';

/** Numéros d'urgence : SAMU (15) et SAMU Maroc (141). */
export const EMERGENCY_NUMBERS = ['15', '141'] as const;

export interface Option<T> {
  value: T;
  label: string;
}

/** Choix exclusif en grands boutons (l'état sélectionné se lit sans la couleur : coche + état d'accessibilité). */
export function OptionGroup<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { row } = useLanguage();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={[styles.options, row]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.option, row, selected && styles.optionSelected]}
            >
              {selected ? <Ionicons name="checkmark" size={18} color={c.primaryText} /> : null}
              <Text style={[styles.optionText, selected && { color: c.primaryText }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Options Oui / Non dans la langue choisie. */
export function useYesNo(): Option<boolean>[] {
  const { t } = useLanguage();
  return [
    { value: true, label: t.common.yes },
    { value: false, label: t.common.no },
  ];
}

/** Boutons d'appel direct des urgences. */
export function EmergencyButtons({ emphasis = false }: { emphasis?: boolean }) {
  const { t, row } = useLanguage();
  return (
    <View style={styles.emergencyRow}>
      {EMERGENCY_NUMBERS.map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={t.shared.call(n)}
          onPress={() => void Linking.openURL(`tel:${n}`)}
          style={({ pressed }) => [styles.emergency, row, emphasis && styles.emergencyStrong, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="call" size={24} color={emphasis ? '#FFFFFF' : c.danger} />
          <Text style={[styles.emergencyText, emphasis && { color: '#FFFFFF' }]}>{t.shared.call(n)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Nombre décimal saisi avec virgule ou point ; NaN si invalide. */
export function parseDecimal(text: string): number {
  const cleaned = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupLabel: { fontSize: font.label, fontWeight: '700', color: c.title },
  options: { flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 52,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: c.inputBorder,
    backgroundColor: c.card,
  },
  optionSelected: { backgroundColor: c.primary, borderColor: c.primary },
  optionText: { color: c.title, fontSize: font.small + 1, fontWeight: '700', textAlign: 'center' },
  emergencyRow: { gap: 10 },
  emergency: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.control,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: c.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emergencyStrong: { backgroundColor: c.danger, borderColor: '#FFFFFF' },
  emergencyText: { color: c.danger, fontSize: 22, fontWeight: '800' },
});
