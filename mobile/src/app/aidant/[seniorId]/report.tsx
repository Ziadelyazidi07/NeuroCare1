/**
 * Rapport PDF hebdomadaire pour le médecin (EF-DA-04, cahier §11) : téléchargé avec le jeton de l'aidant,
 * enregistré dans le cache de l'application puis ouvert dans le partage du téléphone.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { weeklyReportPath } from '../../../api/api';
import { authorizationHeader } from '../../../api/client';
import { getApiBase } from '../../../api/config';
import { addDays, formatDay, mondayOf, toIsoDate } from '../../../lib/dates';
import { errorMessage, networkError, toApiError } from '../../../lib/problem';
import { Button, Card, ErrorText, Field, Notice, Screen, styles } from '../../../ui/components';
import { aidantColours as c } from '../../../ui/theme';

const MAX_OBSERVATIONS = 1000;

export default function Report() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const thisMonday = mondayOf(new Date());
  const weeks = [0, 1, 2, 3].map((n) => addDays(thisMonday, -7 * n));
  const [week, setWeek] = useState(weeks[1]);
  const [observations, setObservations] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const weekStart = toIsoDate(week);
      const authorization = await authorizationHeader();
      let response: Response;
      try {
        response = await fetch((await getApiBase()) + weeklyReportPath(seniorId, weekStart, observations), {
          headers: { Accept: 'application/pdf', ...(authorization ? { Authorization: authorization } : {}) },
        });
      } catch {
        throw networkError();
      }
      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // corps non JSON
        }
        throw toApiError(response.status, body);
      }
      const file = new File(Paths.cache, `neurocare-rapport-${weekStart}.pdf`);
      if (file.exists) file.delete();
      file.create();
      file.write(new Uint8Array(await response.arrayBuffer()));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Rapport NeuroCare' });
      }
      setDone(`Rapport enregistré : ${file.uri.split('/').pop()}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card title="Semaine">
        <View style={{ gap: 8 }}>
          {weeks.map((monday, index) => {
            const selected = toIsoDate(monday) === toIsoDate(week);
            return (
              <Pressable
                key={index}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setWeek(monday)}
                style={{
                  minHeight: 48,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: c.primary,
                  backgroundColor: selected ? c.primary : 'transparent',
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: selected ? c.primaryText : c.primary, fontWeight: '600' }}>
                  {index === 0 ? 'Cette semaine' : index === 1 ? 'Semaine dernière' : `Il y a ${index} semaines`} — du{' '}
                  {formatDay(toIsoDate(monday))} au {formatDay(toIsoDate(addDays(monday, 6)))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card title="Observations pour le médecin (facultatif)">
        <Field
          label={`Vos remarques (${observations.length}/${MAX_OBSERVATIONS})`}
          value={observations}
          onChangeText={(v) => setObservations(v.slice(0, MAX_OBSERVATIONS))}
          multiline
          style={[styles.input, { minHeight: 100, textAlignVertical: 'top', paddingTop: 10 }]}
        />
      </Card>
      <ErrorText message={error} />
      {done ? <Text style={styles.text}>{done}</Text> : null}
      <Button label="Télécharger le rapport PDF" onPress={() => void download()} loading={busy} />
      <Notice>
        Document descriptif : il ne constitue pas un diagnostic. Une confirmation dans l’application ne prouve pas la prise effective du
        médicament.
      </Notice>
    </Screen>
  );
}
