/**
 * Tableau de bord du jour en temps réel (EF-DA-01, EF-DA-02) : pastilles verte / orange / grise mises à
 * jour par STOMP sans rafraîchir, historique 7 jours (EF-DA-03). Descriptif uniquement.
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import type { DashboardHistory, DashboardToday, RealtimeEvent, SeniorDto } from '../../../api/types';
import { formatDay, formatTime } from '../../../lib/dates';
import { pillColour, statusLabel } from '../../../lib/doses';
import { ApiError, errorMessage } from '../../../lib/problem';
import { useSeniorEvents, type RealtimeStatus } from '../../../realtime/useSeniorEvents';
import { Button, Card, ErrorText, Loading, Notice, Pill, styles } from '../../../ui/components';
import { aidantColours as c, pillColours } from '../../../ui/theme';

export default function SeniorDashboard() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const [senior, setSenior] = useState<SeniorDto | null>(null);
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [history, setHistory] = useState<DashboardHistory | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSenior(await aidantApi.senior(seniorId));
      const [t, h] = await Promise.all([aidantApi.dashboardToday(seniorId), aidantApi.dashboardHistory(seniorId, 7)]);
      setToday(t);
      setHistory(h);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', errorMessage(e)));
    }
  }, [seniorId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case 'DOSE_STATUS_CHANGED':
          // Mise à jour immédiate de la pastille, puis rechargement des totaux.
          setToday((current) =>
            current
              ? { ...current, prises: current.prises.map((p) => (p.doseId === event.doseId ? { ...p, statut: event.statut, couleur: event.couleur } : p)) }
              : current,
          );
          if (event.statut === 'SANS_REPONSE') {
            setBanner(`Pas de réponse au rappel « ${event.medication ?? 'médicament'} » de ${formatTime(event.datePrevue)}.`);
          }
          void load();
          break;
        case 'COGNITIVE_SESSION_COMPLETED':
          void load();
          break;
        case 'VOICE_PROFILE_READY':
          setBanner('Votre voix est enregistrée pour les rappels.');
          break;
        case 'DEVICE_UNREACHABLE':
          setBanner('Le téléphone du senior ne reçoit plus les notifications du serveur. Ouvrez l’application sur son téléphone.');
          break;
      }
    },
    [load],
  );
  const realtime = useSeniorEvents(error?.isConsentRequired ? undefined : seniorId, onEvent);

  const navigation = (
    <View style={{ gap: 8 }}>
      <Button label="Traitements" onPress={() => router.push(`/aidant/${seniorId}/medications`)} />
      <Button label="Consentements" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/consents`)} />
      <Button label="Voix des rappels" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/voice`)} />
      <Button label="Rapport PDF" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/report`)} />
      <Button label="Appairer son téléphone" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/pairing`)} />
    </View>
  );

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
      <Stack.Screen options={{ title: senior?.nomComplet ?? 'Tableau de bord' }} />

      {error?.isConsentRequired ? (
        <Notice>
          Le tableau de bord nécessite l’accord de partage familial du senior. Recueillez-le avec lui dans « Consentements ».
        </Notice>
      ) : (
        <ErrorText message={error?.message ?? null} />
      )}
      {banner ? <Notice>{banner}</Notice> : null}

      {today ? (
        <>
          <Card title={`Aujourd'hui (${formatDay(today.date)})`} right={<RealtimeBadge status={realtime} />}>
            {today.prises.length === 0 ? <Text style={styles.muted}>Aucun rappel aujourd’hui.</Text> : null}
            {today.prises.map((p) => (
              <View key={p.doseId} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>
                    {formatTime(p.datePrevue)} · {p.nomMedicament}
                  </Text>
                  {p.horodatageAction && p.statut === 'CONFIRME' ? (
                    <Text style={styles.muted}>Confirmé à {formatTime(p.horodatageAction)}</Text>
                  ) : null}
                </View>
                <Pill colour={pillColour(p.statut)} label={statusLabel(p.statut)} />
              </View>
            ))}
            <Text style={styles.muted}>
              {today.resume.confirmees} confirmé(s) · {today.resume.sansReponse} sans réponse · {today.resume.enAttente} en attente
            </Text>
          </Card>

          <Card title="Dernier exercice">
            {today.dernierExercice ? (
              <Text style={styles.text}>
                {formatDay(today.dernierExercice.dateExercice)} : {today.dernierExercice.corrects} mot(s) retrouvé(s) sur{' '}
                {today.dernierExercice.motsPresentes}
                {today.dernierExercice.interrompu ? ' (interrompu)' : ''}
              </Text>
            ) : (
              <Text style={styles.muted}>Aucun exercice pour le moment.</Text>
            )}
          </Card>
        </>
      ) : !error ? (
        <Loading />
      ) : null}

      {history ? (
        <Card title="7 derniers jours">
          {history.jours.map((j) => (
            <View key={j.date} style={[styles.row, { paddingVertical: 2 }]}>
              <Text style={[styles.muted, { width: 52 }]}>{formatDay(j.date)}</Text>
              <View style={{ flex: 1, flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EEF0F2' }}>
                <View style={{ flex: j.confirmees, backgroundColor: pillColours.VERT }} />
                <View style={{ flex: j.sansReponse, backgroundColor: pillColours.ORANGE }} />
                <View style={{ flex: j.enAttente + j.desactivees, backgroundColor: pillColours.GRIS }} />
              </View>
              <Text style={[styles.muted, { width: 64, textAlign: 'right' }]}>
                {j.tauxConfirmation !== undefined ? `${Math.round(j.tauxConfirmation)} %` : '—'}
              </Text>
            </View>
          ))}
          <Text style={styles.muted}>Taux de confirmation : part des rappels confirmés parmi les rappels clôturés.</Text>
        </Card>
      ) : null}

      {today ? <Notice>{today.avertissement}</Notice> : null}
      {navigation}
    </ScrollView>
  );
}

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  const label = status === 'connecte' ? 'En direct' : status === 'connexion' ? 'Connexion…' : 'Hors ligne';
  const colour = status === 'connecte' ? pillColours.VERT : pillColours.GRIS;
  return (
    <View style={styles.row} accessibilityLabel={`Temps réel : ${label}`}>
      <View style={[styles.dot, { backgroundColor: colour, width: 10, height: 10 }]} />
      <Text style={[styles.muted, { color: c.text }]}>{label}</Text>
    </View>
  );
}
