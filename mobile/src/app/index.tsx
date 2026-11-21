/**
 * Accueil : carte de bienvenue avec le sélecteur de langue, grille des 6 modules NeuroCare, rappel éthique,
 * adresse du serveur et bouton flottant « Assistant Santé » (en bas à droite, à gauche en arabe). Exception : un téléphone senior ouvert par une alarme va droit à son écran de rappel.
 */
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBase, setApiBase } from '../api/config';
import { useSession } from '../auth/SessionContext';
import { useLanguage, type Language } from '../i18n';
import { MODULES, type ModuleDefinition } from '../modules';
import { hasLaunchReminder } from '../senior/reminders';
import { Button, Field, Loading, Row, Text, colours as c, radius, shadow } from '../theme';

export default function ModulesHome() {
  const { session, loading } = useSession();
  const { t, row } = useLanguage();
  const [launchedByAlarm] = useState(hasLaunchReminder);
  const [apiBase, setApiBaseState] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getApiBase().then(setApiBaseState);
  }, []);

  if (loading) return <Loading />;
  if (launchedByAlarm && session?.kind === 'senior') return <Redirect href="/senior" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.welcome}>
          <Image
            source={LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={t.home.logoLabel}
          />
          <Row style={styles.brandRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand} accessibilityRole="header">
                {t.home.title}
              </Text>
              <Text style={styles.hello}>{t.home.welcome}</Text>
            </View>
          </Row>
          <Text style={styles.subtitle}>{t.home.subtitle}</Text>
          <LanguageSwitch />
        </View>

        <View style={[styles.grid, row]}>
          {MODULES.map((module) => (
            <ModuleTile key={module.id} module={module} />
          ))}
        </View>

        <Row style={styles.ethics} accessibilityRole="text">
          <Ionicons name="shield-checkmark" size={22} color={c.primary} />
          <Text style={styles.ethicsText}>{t.home.ethics}</Text>
        </Row>

        <View style={styles.server}>
          {editing ? (
            <>
              <Field label={t.home.apiLabel} value={apiBase} onChangeText={setApiBaseState} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <Button
                label={t.common.save}
                variant="secondary"
                onPress={async () => {
                  await setApiBase(apiBase);
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityHint={t.home.serverHint}>
              <Text style={styles.serverText}>{t.home.server(apiBase)}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      <AssistantFab />
    </SafeAreaView>
  );
}

/** Bouton flottant de l'Assistant Santé : bulle de discussion + micro, libellé court lisible par un senior. */
function AssistantFab() {
  const { t, isRTL, row } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.assistant.fabA11y}
      onPress={() => router.push('/assistant')}
      style={({ pressed }) => [styles.fab, row, isRTL ? { left: 16 } : { right: 16 }, pressed && styles.pressed]}
    >
      <View style={styles.fabIcon}>
        <Ionicons name="chatbubble-ellipses" size={30} color="#FFFFFF" />
        <View style={[styles.fabMic, isRTL ? { left: -6 } : { right: -6 }]}>
          <Ionicons name="mic" size={15} color={c.primary} />
        </View>
      </View>
      <Text style={styles.fabText}>{t.assistant.fab}</Text>
    </Pressable>
  );
}

const LOGO = require('../../assets/images/neurocare-logo.png') as number;

const LANGUAGES: { value: Language; code: string; name: string }[] = [
  { value: 'fr', code: 'FR', name: 'Français' },
  { value: 'ar', code: 'AR', name: 'العربية' },
];

/** Sélecteur Français / العربية : deux pilules, appliqué tout de suite à toute l'application. */
function LanguageSwitch() {
  const { t, language, setLanguage } = useLanguage();
  return (
    <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel={t.home.languageLabel}>
      {LANGUAGES.map((option) => {
        const selected = option.value === language;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.name}
            onPress={() => setLanguage(option.value)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.pillCode, selected && styles.pillTextSelected]}>{option.code}</Text>
            <Text style={[styles.pillName, selected && styles.pillTextSelected]}>{option.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModuleTile({ module }: { module: ModuleDefinition }) {
  const { t } = useLanguage();
  const text = t.home.modules[module.id];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text.title}. ${text.subtitle}`}
      onPress={() => router.push(module.route)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: module.tint }]}>
        <Ionicons name={module.icon} size={32} color={module.colour} />
      </View>
      <Text style={styles.tileTitle}>{text.title}</Text>
      <Text style={styles.tileText}>{text.subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  // Marge basse : le bouton flottant de l'assistant ne cache jamais les dernières cartes.
  content: { padding: 16, gap: 16, paddingBottom: 128 },
  welcome: { backgroundColor: c.card, borderRadius: radius.card + 4, padding: 20, gap: 14, borderWidth: 1, borderColor: c.border, ...shadow },
  brandRow: { gap: 12 },
  logo: { width: '100%', height: 168, borderRadius: radius.card, backgroundColor: '#F0F6FD' },
  brand: { fontSize: 30, fontWeight: '800', color: c.title },
  hello: { fontSize: 17, color: c.muted },
  subtitle: { fontSize: 18, lineHeight: 26, color: c.text },
  switch: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: c.inputBorder,
    backgroundColor: c.background,
  },
  pillSelected: { backgroundColor: c.primary, borderColor: c.primary },
  pillCode: { fontSize: 15, fontWeight: '800', color: c.primary, textAlign: 'center' },
  pillName: { fontSize: 18, fontWeight: '700', color: c.title, textAlign: 'center' },
  pillTextSelected: { color: c.primaryText },
  grid: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  tile: {
    width: '48%',
    minHeight: 172,
    backgroundColor: c.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...shadow,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 18, fontWeight: '800', color: c.title, textAlign: 'center' },
  tileText: { fontSize: 16, lineHeight: 21, color: c.muted, textAlign: 'center' },
  ethics: { gap: 10, alignItems: 'flex-start', backgroundColor: c.primarySoft, borderRadius: radius.card, padding: 16 },
  ethicsText: { flex: 1, fontSize: 16, lineHeight: 23, color: c.title },
  server: { alignItems: 'center', gap: 8 },
  fab: {
    position: 'absolute',
    bottom: 24,
    minHeight: 68,
    alignItems: 'center',
    gap: 12,
    paddingStart: 14,
    paddingEnd: 22,
    borderRadius: radius.pill,
    backgroundColor: c.primary,
    shadowColor: '#0F3D6E',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fabMic: {
    position: 'absolute',
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  serverText: { fontSize: 16, color: c.muted, textAlign: 'center', textDecorationLine: 'underline' },
});
