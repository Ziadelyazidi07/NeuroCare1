/**
 * Accueil : grille des 5 modules NeuroCare (façon lanceur d'applications), adresse du serveur et rappel
 * éthique. Exception : un téléphone senior ouvert par une alarme va droit à son écran de rappel.
 */
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBase, setApiBase } from '../api/config';
import { useSession } from '../auth/SessionContext';
import { MODULES, type ModuleDefinition } from '../modules';
import { hasLaunchReminder } from '../senior/reminders';
import { Button, Field, Loading } from '../ui/components';
import { MIN_TOUCH, aidantColours as c } from '../ui/theme';

export default function ModulesHome() {
  const { session, loading } = useSession();
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
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            NeuroCare
          </Text>
          <Text style={styles.subtitle}>Choisissez un module</Text>
        </View>

        <View style={styles.grid}>
          {MODULES.map((module) => (
            <ModuleTile key={module.id} module={module} />
          ))}
        </View>

        <View style={styles.ethics} accessibilityRole="text">
          <Ionicons name="information-circle-outline" size={22} color={c.text} />
          <Text style={styles.ethicsText}>
            NeuroCare est un outil de pré-dépistage et d’aide à la décision médicale. Il ne pose jamais de diagnostic.
          </Text>
        </View>

        <View style={styles.server}>
          {editing ? (
            <>
              <Field
                label="Adresse de l'API"
                value={apiBase}
                onChangeText={setApiBaseState}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Button
                label="Enregistrer"
                variant="secondary"
                onPress={async () => {
                  await setApiBase(apiBase);
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityHint="Modifier l'adresse du serveur">
              <Text style={styles.serverText}>Serveur : {apiBase} (modifier)</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModuleTile({ module }: { module: ModuleDefinition }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${module.title}. ${module.subtitle}`}
      onPress={() => router.push(module.route)}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: module.colour }]}>
        <Ionicons name={module.icon} size={34} color="#FFFFFF" />
      </View>
      <Text style={styles.tileTitle}>{module.title}</Text>
      <Text style={styles.tileText}>{module.subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 16 },
  header: { alignItems: 'center', marginTop: 8 },
  title: { fontSize: 36, fontWeight: '800', color: c.primary },
  subtitle: { fontSize: 16, color: c.muted, marginTop: 4, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: {
    width: '48%',
    minHeight: MIN_TOUCH * 2.4,
    backgroundColor: c.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.7 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 17, fontWeight: '800', color: c.text, textAlign: 'center' },
  tileText: { fontSize: 13, color: c.muted, textAlign: 'center' },
  ethics: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: c.warningBg,
    borderColor: c.warningBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  ethicsText: { flex: 1, fontSize: 14, color: c.text },
  server: { gap: 8 },
  serverText: { fontSize: 13, color: c.muted, textAlign: 'center' },
});
