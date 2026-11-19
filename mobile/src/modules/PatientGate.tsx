/**
 * Patient d'un module de pré-dépistage : le senior lui-même (téléphone appairé) ou l'un des proches de
 * l'aidant connecté. Sans session, invite à se connecter via « Rappels & Suivi ».
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { aidantApi } from '../api/api';
import type { SeniorDto } from '../api/types';
import { useSession } from '../auth/SessionContext';
import { errorMessage } from '../lib/problem';
import { Button, Card, ErrorText, Loading, Notice, styles } from '../ui/components';
import { aidantColours as c } from '../ui/theme';

export interface Patient {
  seniorId: string;
  nom: string;
}

export function PatientGate({ children }: { children: (patient: Patient) => ReactNode }) {
  const { session, loading } = useSession();
  const [seniors, setSeniors] = useState<SeniorDto[] | null>(null);
  const [chosen, setChosen] = useState<Patient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAidant = session?.kind === 'aidant';

  useEffect(() => {
    if (!isAidant) return;
    aidantApi
      .seniors()
      .then((list) => {
        setSeniors(list);
        if (list.length === 1) setChosen({ seniorId: list[0].id, nom: list[0].nomComplet });
      })
      .catch((e) => setError(errorMessage(e)));
  }, [isAidant]);

  if (loading) return <Loading />;

  if (session?.kind === 'senior') {
    return <>{children({ seniorId: session.seniorId, nom: session.nomComplet })}</>;
  }

  if (!session) {
    return (
      <Card title="Connexion nécessaire">
        <Text style={styles.text}>
          Les mesures sont enregistrées dans le dossier du patient. Connectez-vous d’abord comme aidant, ou appairez le
          téléphone du senior, depuis « Rappels & Suivi ».
        </Text>
        <Button label="Aller à Rappels & Suivi" onPress={() => router.push('/observance-role')} />
      </Card>
    );
  }

  if (chosen) {
    return (
      <>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={[styles.text, { fontWeight: '700', flex: 1 }]}>Patient : {chosen.nom}</Text>
          {seniors && seniors.length > 1 ? (
            <Pressable accessibilityRole="button" onPress={() => setChosen(null)} hitSlop={8}>
              <Text style={{ color: c.primary, fontWeight: '600' }}>Changer</Text>
            </Pressable>
          ) : null}
        </View>
        {children(chosen)}
      </>
    );
  }

  return (
    <Card title="Pour quel proche ?">
      <ErrorText message={error} />
      {seniors === null && !error ? <Loading /> : null}
      {seniors?.length === 0 ? (
        <Notice>Ajoutez d’abord un proche dans « Rappels & Suivi ».</Notice>
      ) : null}
      {seniors?.map((s) => (
        <Button key={s.id} label={s.nomComplet} variant="secondary" onPress={() => setChosen({ seniorId: s.id, nom: s.nomComplet })} />
      ))}
    </Card>
  );
}
