/** Accueil : choix de l'espace (senior ou aidant) et adresse du serveur. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiBase, setApiBase } from '../api/config';
import { useSession } from '../auth/SessionContext';
import { Button, Field, Loading } from '../ui/components';
import { MIN_TOUCH, aidantColours as c } from '../ui/theme';

export default function Welcome() {
  const { session, loading } = useSession();
  const [apiBase, setApiBaseState] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    getApiBase().then(setApiBaseState);
  }, []);

  if (loading) return <Loading />;
  if (session?.kind === 'senior') return <Redirect href="/senior" />;
  if (session?.kind === 'aidant') return <Redirect href="/aidant" />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          NeuroCare
        </Text>
        <Text style={styles.subtitle}>Rappels de traitement et suivi bienveillant</Text>
      </View>

      <Pressable accessibilityRole="button" style={[styles.choice, styles.senior]} onPress={() => router.push('/senior/pair')}>
        <Text style={styles.choiceTitle}>Je suis senior</Text>
        <Text style={styles.choiceText}>J’entre le code donné par mon proche</Text>
      </Pressable>

      <Pressable accessibilityRole="button" style={[styles.choice, styles.aidant]} onPress={() => router.push('/aidant/login')}>
        <Text style={[styles.choiceTitle, { color: c.primary }]}>Je suis aidant</Text>
        <Text style={[styles.choiceText, { color: c.text }]}>Connexion par téléphone et mot de passe</Text>
      </Pressable>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20, gap: 16, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 36, fontWeight: '800', color: c.primary },
  subtitle: { fontSize: 16, color: c.muted, marginTop: 4, textAlign: 'center' },
  choice: { minHeight: MIN_TOUCH * 2, borderRadius: 16, padding: 20, justifyContent: 'center' },
  senior: { backgroundColor: '#000000' },
  aidant: { backgroundColor: c.card, borderWidth: 2, borderColor: c.primary },
  choiceTitle: { fontSize: 28, fontWeight: '800', color: '#FFD60A' },
  choiceText: { fontSize: 18, color: '#FFFFFF', marginTop: 4 },
  server: { marginTop: 24, gap: 8 },
  serverText: { fontSize: 13, color: c.muted, textAlign: 'center' },
});
