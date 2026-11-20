/**
 * Tableau de bord du jour en temps réel (EF-DA-01, EF-DA-02) : pastilles verte / orange / grise mises à
 * jour par STOMP sans rafraîchir, historique 7 jours (EF-DA-03). Descriptif uniquement.
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import type { DashboardHistory, DashboardToday, RealtimeEvent, SeniorDto } from '../../../api/types';
import { formatDay, formatTime } from '../../../lib/dates';
import { pillColour, statusLabel } from '../../../lib/doses';
import { ApiError, errorMessage } from '../../../lib/problem';
import { useSeniorEvents, type RealtimeStatus } from '../../../realtime/useSeniorEvents';
import { useLanguage } from '../../../i18n';
import { Button, Card, colours as c, ErrorText, Loading, Notice, Pill, pillColours, Row, styles, Text } from '../../../theme';

export default function SeniorDashboard() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const { t } = useLanguage();
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
      setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', errorMessage(e, t)));
    }
  }, [seniorId, t]);

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
            setBanner(t.dashboard.noAnswer(event.medication ?? t.dashboard.medication, formatTime(event.datePrevue)));
          }
          void load();
          break;
        case 'COGNITIVE_SESSION_COMPLETED':
          void load();
          break;
        case 'VOICE_PROFILE_READY':
          setBanner(t.dashboard.voiceReady);
          break;
        case 'DEVICE_UNREACHABLE':
          setBanner(t.dashboard.unreachable);
          break;
      }
    },
    [load, t],
  );
  const realtime = useSeniorEvents(error?.isConsentRequired ? undefined : seniorId, onEvent);

  const navigation = (
    <View style={{ gap: 8 }}>
      <Button label={t.dashboard.medications} icon="medkit" onPress={() => router.push(`/aidant/${seniorId}/medications`)} />
      <Button label={t.dashboard.consents} icon="shield-checkmark" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/consents`)} />
      <Button label={t.dashboard.voice} icon="mic" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/voice`)} />
      <Button label={t.dashboard.report} icon="document-text" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/report`)} />
      <Button label={t.dashboard.pairing} icon="phone-portrait" variant="secondary" onPress={() => router.push(`/aidant/${seniorId}/pairing`)} />
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
      <Stack.Screen options={{ title: senior?.nomComplet ?? t.nav.dashboard }} />

      {error?.isConsentRequired ? (
        <Notice>{t.dashboard.consentRequired}</Notice>
      ) : (
        <ErrorText message={error?.message ?? null} />
      )}
      {banner ? <Notice>{banner}</Notice> : null}

      {today ? (
        <>
          <Card title={t.dashboard.today(formatDay(today.date))} icon="today" right={<RealtimeBadge status={realtime} />}>
            {today.prises.length === 0 ? <Text style={styles.muted}>{t.dashboard.noneToday}</Text> : null}
            {today.prises.map((p) => (
              <Row key={p.doseId} style={{ justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.text}>
                    {formatTime(p.datePrevue)} · {p.nomMedicament}
                  </Text>
                  {p.horodatageAction && p.statut === 'CONFIRME' ? (
                    <Text style={styles.muted}>{t.dashboard.confirmedAt(formatTime(p.horodatageAction))}</Text>
                  ) : null}
                </View>
                <Pill colour={pillColour(p.statut)} label={statusLabel(p.statut, t)} />
              </Row>
            ))}
            <Text style={styles.muted}>
              {t.dashboard.summary(today.resume.confirmees, today.resume.sansReponse, today.resume.enAttente)}
            </Text>
          </Card>

          <Card title={t.dashboard.lastExercise} icon="bulb">
            {today.dernierExercice ? (
              <Text style={styles.text}>
                {t.dashboard.exercise(
                  formatDay(today.dernierExercice.dateExercice),
                  today.dernierExercice.corrects,
                  today.dernierExercice.motsPresentes,
                  !!today.dernierExercice.interrompu,
                )}
              </Text>
            ) : (
              <Text style={styles.muted}>{t.dashboard.noExercise}</Text>
            )}
          </Card>
        </>
      ) : !error ? (
        <Loading />
      ) : null}

      {history ? (
        <Card title={t.dashboard.week} icon="stats-chart">
          {history.jours.map((j) => (
            <Row key={j.date} style={{ paddingVertical: 3 }}>
              <Text style={[styles.muted, { width: 52 }]}>{formatDay(j.date)}</Text>
              <Row style={{ flex: 1, gap: 0, height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EEF2F7' }}>
                <View style={{ flex: j.confirmees, backgroundColor: pillColours.VERT }} />
                <View style={{ flex: j.sansReponse, backgroundColor: pillColours.ORANGE }} />
                <View style={{ flex: j.enAttente + j.desactivees, backgroundColor: pillColours.GRIS }} />
              </Row>
              <Text style={[styles.muted, { width: 64, textAlign: 'center' }]}>
                {j.tauxConfirmation !== undefined ? `${Math.round(j.tauxConfirmation)} %` : '—'}
              </Text>
            </Row>
          ))}
          <Text style={styles.muted}>{t.dashboard.rateNote}</Text>
        </Card>
      ) : null}

      {today ? <Notice>{today.avertissement}</Notice> : null}
      {navigation}
    </ScrollView>
  );
}

function RealtimeBadge({ status }: { status: RealtimeStatus }) {
  const { t } = useLanguage();
  const label = status === 'connecte' ? t.dashboard.live : status === 'connexion' ? t.dashboard.connecting : t.dashboard.offline;
  const colour = status === 'connecte' ? pillColours.VERT : pillColours.GRIS;
  return (
    <Row accessibilityLabel={t.dashboard.realtime(label)}>
      <View style={[styles.dot, { backgroundColor: colour, width: 10, height: 10 }]} />
      <Text style={[styles.muted, { color: c.text }]}>{label}</Text>
    </Row>
  );
}
