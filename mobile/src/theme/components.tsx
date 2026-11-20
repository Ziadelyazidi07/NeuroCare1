/**
 * Composants du thème médical, communs à tous les écrans. Ils suivent la langue choisie : en arabe, le
 * texte s'aligne à droite et les rangées s'inversent, sans redémarrer l'application.
 */
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLanguage } from '../i18n';
import { MIN_TOUCH, colours as c, font, pillColours, radius, shadow } from './tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Texte orienté selon la langue (un `textAlign` explicite dans `style` reste prioritaire). */
export function Text({ style, ...props }: TextProps) {
  const { text } = useLanguage();
  return <RNText {...props} style={[text, style]} />;
}

/** Rangée orientée selon la langue. */
export function Row({ children, style, ...props }: ComponentProps<typeof View>) {
  const { row } = useLanguage();
  return (
    <View {...props} style={[styles.row, style, row]}>
      {children}
    </View>
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ title, children, right, icon }: { title?: string; children: ReactNode; right?: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.card}>
      {title ? (
        <Row style={styles.cardHeader}>
          {icon ? (
            <View style={styles.cardIcon}>
              <Ionicons name={icon} size={20} color={c.primary} />
            </View>
          ) : null}
          <Text style={styles.cardTitle} accessibilityRole="header">
            {title}
          </Text>
          {right}
        </Row>
      ) : null}
      {children}
    </View>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const inactive = disabled || loading;
  const fg = variant === 'secondary' ? c.primary : c.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
        <ActivityIndicator color={fg} />
      ) : (
        <Row style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={22} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </Row>
      )}
    </Pressable>
  );
}

/** Nom historique : même bouton que `PrimaryButton`. */
export const Button = PrimaryButton;

type BadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const BADGE: Record<BadgeTone, { bg: string; fg: string }> = {
  info: { bg: c.primarySoft, fg: '#1747B0' },
  success: { bg: c.successSoft, fg: c.success },
  warning: { bg: c.warningSoft, fg: c.warning },
  danger: { bg: c.dangerSoft, fg: c.danger },
  neutral: { bg: '#EEF2F7', fg: c.muted },
};

/** Étiquette pastel : le libellé porte toujours l'information (jamais la couleur seule). */
export function Badge({ label, tone = 'info', colours }: { label: string; tone?: BadgeTone; colours?: { bg: string; fg: string } }) {
  const palette = colours ?? BADGE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

/** En-tête d'un module : pastille pastel avec icône, titre et sous-titre. */
export function ModuleHeader({
  title,
  subtitle,
  icon,
  colour,
  tint,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  colour: string;
  tint: string;
}) {
  return (
    <Row style={styles.moduleHeader}>
      <View style={[styles.moduleIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={30} color={colour} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.moduleTitle} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
    </Row>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const { text } = useLanguage();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} style={[styles.input, text, style]} {...props} />
    </View>
  );
}

/** Champ de mot de passe avec un bouton œil pour l'afficher en clair ou le masquer. */
export function PasswordField({ label, ...props }: Omit<TextInputProps, 'secureTextEntry'> & { label: string }) {
  const [visible, setVisible] = useState(false);
  const { t, isRTL, text } = useLanguage();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          style={[styles.input, text, isRTL ? { paddingLeft: 52 } : { paddingRight: 52 }]}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? t.common.hidePassword : t.common.showPassword}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          style={[styles.eye, isRTL ? { left: 0 } : { right: 0 }]}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={24} color={c.muted} />
        </Pressable>
      </View>
    </View>
  );
}

/** Case à cocher : l'état se lit aussi sans la couleur (coche et état d'accessibilité). */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const { row } = useLanguage();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={[styles.checkboxRow, row]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={18} color={c.primaryText} /> : null}
      </View>
      <Text style={[styles.text, { flex: 1 }]}>{label}</Text>
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
    <Row style={styles.notice}>
      <Ionicons name="information-circle" size={22} color={c.warning} />
      <Text style={styles.noticeText}>{children}</Text>
    </Row>
  );
}

/** Pastille : couleur et libellé toujours ensemble (l'information ne repose jamais sur la couleur seule). */
export function Pill({ colour, label }: { colour: keyof typeof pillColours; label: string }) {
  return (
    <Row style={styles.pill} accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: pillColours[colour] }]} />
      <Text style={[styles.pillText, { color: pillColours[colour] }]}>{label}</Text>
    </Row>
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
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { backgroundColor: c.card, borderRadius: radius.card, padding: 18, gap: 12, borderWidth: 1, borderColor: c.border, ...shadow },
  cardHeader: { justifyContent: 'space-between' },
  cardIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: font.title - 2, fontWeight: '800', color: c.title },
  text: { fontSize: font.body, lineHeight: font.body * 1.4, color: c.text },
  muted: { fontSize: font.small, lineHeight: font.small * 1.4, color: c.muted },
  title: { fontSize: font.header, fontWeight: '800', color: c.title },
  button: {
    minHeight: 56,
    borderRadius: radius.control,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonInner: { justifyContent: 'center' },
  buttonSecondary: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.primary },
  buttonDanger: { backgroundColor: c.danger },
  buttonText: { fontSize: font.button, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'center' },
  badgeText: { fontSize: 15, fontWeight: '800' },
  moduleHeader: { gap: 14, alignItems: 'center' },
  moduleIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  moduleTitle: { fontSize: font.header - 2, fontWeight: '800', color: c.title },
  field: { gap: 6 },
  label: { fontSize: font.label, fontWeight: '700', color: c.title },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: c.inputBorder,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    fontSize: font.body + 1,
    color: c.text,
    backgroundColor: c.card,
  },
  passwordRow: { justifyContent: 'center' },
  eye: { position: 'absolute', width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  checkboxRow: { minHeight: 52, alignItems: 'center', gap: 12 },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: c.primary },
  error: { color: c.danger, fontSize: font.small, fontWeight: '600' },
  notice: { backgroundColor: c.warningBg, borderColor: c.warningBorder, borderWidth: 1, borderRadius: radius.control, padding: 14, alignItems: 'flex-start' },
  noticeText: { flex: 1, color: c.text, fontSize: font.small, lineHeight: font.small * 1.4 },
  pill: { gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  pillText: { fontSize: font.small, fontWeight: '700' },
  loading: { padding: 32, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export { MIN_TOUCH };
