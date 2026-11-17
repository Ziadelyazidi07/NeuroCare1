/** Liste des seniors suivis par l'aidant. */
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';

import { aidantApi } from '../../api/api';
import type { SeniorDto } from '../../api/types';
import { useSession } from '../../auth/SessionContext';
import { errorMessage } from '../../lib/problem';
import { Button, Card, ErrorText, Loading, styles } from '../../ui/components';
import { aidantColours as c } from '../../ui/theme';

export default function SeniorsList() {
  const { session, signOut } = useSession();
  const [seniors, setSeniors] = useState<SeniorDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSeniors(await aidantApi.seniors());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!session || session.kind !== 'aidant') return <Redirect href="/" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.muted}>Connecté(e) : {session.nomComplet}</Text>
      <ErrorText message={error} />
      {seniors === null && !error ? <Loading /> : null}
      {seniors?.length === 0 ? <Text style={styles.text}>Aucun proche pour l’instant.</Text> : null}
      {seniors?.map((senior) => (
        <Pressable key={senior.id} accessibilityRole="button" onPress={() => router.push(`/aidant/${senior.id}`)}>
          <Card title={senior.nomComplet}>
            <Text style={styles.muted}>
              {[senior.lien?.lienParente, senior.lien?.surnomSenior && `« ${senior.lien.surnomSenior} »`]
                .filter(Boolean)
                .join(' · ') || 'Proche'}
              {senior.donneesFictives ? ' · données fictives' : ''}
            </Text>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: senior.lien?.consentementValide ? '#1E8E3E' : '#80868B' }]} />
              <Text style={[styles.muted, { color: c.text }]}>
                {senior.lien?.consentementValide ? 'Partage familial accordé' : 'Partage familial non accordé'}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
      <Button label="Ajouter un proche" onPress={() => router.push('/aidant/new-senior')} />
      <Button label="Se déconnecter" variant="secondary" onPress={() => void signOut().then(() => router.replace('/'))} />
    </ScrollView>
  );
}
