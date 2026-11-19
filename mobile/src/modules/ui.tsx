/** Composants communs aux modules de pré-dépistage (aucune logique propre à un module). */
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_TOUCH, aidantColours as c } from '../ui/theme';

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
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.optionSelected]}
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

export const YES_NO: Option<boolean>[] = [
  { value: true, label: 'Oui' },
  { value: false, label: 'Non' },
];

/** Boutons d'appel direct des urgences. */
export function EmergencyButtons({ emphasis = false }: { emphasis?: boolean }) {
  return (
    <View style={styles.emergencyRow}>
      {EMERGENCY_NUMBERS.map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={`Appeler le ${n}`}
          onPress={() => void Linking.openURL(`tel:${n}`)}
          style={({ pressed }) => [styles.emergency, emphasis && styles.emergencyStrong, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="call" size={24} color={emphasis ? '#FFFFFF' : '#B3261E'} />
          <Text style={[styles.emergencyText, emphasis && { color: '#FFFFFF' }]}>Appeler le {n}</Text>
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
  group: { gap: 6 },
  groupLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 48,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.card,
  },
  optionSelected: { backgroundColor: c.primary },
  optionText: { color: c.primary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emergencyRow: { gap: 8 },
  emergency: {
    minHeight: MIN_TOUCH,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#B3261E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emergencyStrong: { backgroundColor: '#B3261E', borderColor: '#FFFFFF' },
  emergencyText: { color: '#B3261E', fontSize: 22, fontWeight: '800' },
});
