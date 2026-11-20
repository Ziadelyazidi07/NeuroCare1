/** Liste des seniors suivis par l'aidant. */
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';

import { aidantApi } from '../../api/api';
import type { SeniorDto } from '../../api/types';
import { useSession } from '../../auth/SessionContext';
import { errorMessage } from '../../lib/problem';
import { useLanguage } from '../../i18n';
import { Button, Card, colours as c, ErrorText, Loading, Notice, pillColours, Row, styles, Text } from '../../theme';

export default function SeniorsList() {
  const { session, signOut } = useSession();
  const { t } = useLanguage();
  const [seniors, setSeniors] = useState<SeniorDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSeniors(await aidantApi.seniors());
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [t]);

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
      <Text style={styles.muted}>{t.list.connected(session.nomComplet)}</Text>
      {session.demo ? <Notice>{t.demo.badge}</Notice> : null}
      <ErrorText message={error} />
      {seniors === null && !error ? <Loading /> : null}
      {seniors?.length === 0 ? <Text style={styles.text}>{t.list.none}</Text> : null}
      {seniors?.map((senior) => (
        <Pressable key={senior.id} accessibilityRole="button" onPress={() => router.push(`/aidant/${senior.id}`)}>
          <Card title={senior.nomComplet} icon="person">
            <Text style={styles.muted}>
              {[senior.lien?.lienParente, senior.lien?.surnomSenior && `« ${senior.lien.surnomSenior} »`]
                .filter(Boolean)
                .join(' · ') || t.list.relative}
              {senior.donneesFictives ? t.list.fictive : ''}
            </Text>
            <Row>
              <View style={[styles.dot, { backgroundColor: senior.lien?.consentementValide ? pillColours.VERT : pillColours.GRIS }]} />
              <Text style={[styles.muted, { color: c.text }]}>
                {senior.lien?.consentementValide ? t.list.shared : t.list.notShared}
              </Text>
            </Row>
          </Card>
        </Pressable>
      ))}
      <Button label={t.list.add} icon="person-add" onPress={() => router.push('/aidant/new-senior')} />
      <Button label={t.list.signOut} variant="secondary" onPress={() => void signOut().then(() => router.replace('/'))} />
    </ScrollView>
  );
}
