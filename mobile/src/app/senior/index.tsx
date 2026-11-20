/**
 * Écran principal du senior (cahier §2.1, ENF-08) : un seul écran, police ≥ 24 sp, contraste élevé,
 * gros bouton « C'est fait » ≥ 64 dp, audio pour chaque action. Fonctionne hors ligne. À l'heure d'une
 * prise, l'alerte s'affiche et la voix de l'aidant, déjà téléchargée, part automatiquement.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

import { seniorApi } from '../../api/api';
import type { DoseDto, RealtimeEvent, SeniorDto } from '../../api/types';
import { useSession } from '../../auth/SessionContext';
import { useLanguage } from '../../i18n';
import { formatTime } from '../../lib/dates';
import { currentDose, doseToAnnounce, isConfirmable, isDue, msUntilNextDue } from '../../lib/doses';
import { useSeniorEvents } from '../../realtime/useSeniorEvents';
import { confirmDose, refreshDoses, cachedDoses } from '../../senior/offlineStore';
import { hasReminderVoice, playReminder, prefetchReminderAudio, stopAudio } from '../../senior/reminderAudio';
import {
  configureReminders,
  consumeLaunchReminder,
  devicePushToken,
  enableAlerts,
  getAlertPermissions,
  onReminderReceived,
  onReminderTapped,
  scheduleReminders,
  type AlertPermissions,
} from '../../senior/reminders';
import { MIN_TOUCH, SENIOR_MIN_FONT, Text, seniorColours, shadow } from '../../theme';
import { HomeButton } from '../../ui/HomeButton';

const PROFILE_KEY = 'neurocare.senior.profile';
const MAX_TIMER_MS = 60_000;

export default function SeniorHome() {
  const { session, signOut } = useSession();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<SeniorDto | null>(null);
  const [doses, setDoses] = useState<DoseDto[]>([]);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const [alerts, setAlerts] = useState<AlertPermissions | null>(null);
  const announced = useRef(new Set<string>());
  const dosesRef = useRef<DoseDto[]>([]);
  const refreshRun = useRef(0);

  const seniorId = session?.kind === 'senior' ? session.seniorId : undefined;
  const colours = profile?.contrasteEleve === false ? seniorColours.normal : seniorColours.high;
  const font = Math.max(SENIOR_MIN_FONT, profile?.taillePolice ?? 28);

  const applyDoses = useCallback((list: DoseDto[]) => {
    dosesRef.current = list;
    setDoses(list);
  }, []);

  const refresh = useCallback(
    async (withAudio = true) => {
      if (!seniorId) return;
      const run = ++refreshRun.current;
      try {
        const result = await refreshDoses();
        if (run !== refreshRun.current) {
          // Une synchronisation plus récente a pris le relais, mais elle ne télécharge pas forcément la voix.
          if (withAudio && result.online) await prefetchReminderAudio(result.doses);
          return;
        }
        applyDoses(result.doses);
        setOnline(result.online);
        await scheduleReminders(result.doses);
        if (result.online) {
          const fresh = await seniorApi.profile(seniorId);
          setProfile(fresh);
          await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
          if (withAudio) await prefetchReminderAudio(result.doses);
        }
        setNow(new Date());
      } catch {
        setOnline(false);
      }
    },
    [seniorId, applyDoses],
  );

  const announce = useCallback((target: DoseDto) => {
    announced.current.add(target.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    void playReminder(target);
  }, []);

  /** Rappel demandé par une notification touchée : la voix est toujours rejouée. */
  const playFromNotification = useCallback((doseId: unknown) => {
    const target = dosesRef.current.find((d) => d.id === doseId) ?? currentDose(dosesRef.current);
    if (target) announced.current.add(target.id);
    void playReminder(target ?? null);
  }, []);

  // Temps réel : l'écran se met à jour seul quand l'aidant change un traitement ou sa voix.
  const onRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case 'REMINDERS_UPDATED':
        case 'VOICE_PROFILE_READY':
          void refresh();
          break;
        case 'DOSE_STATUS_CHANGED':
          void refresh(false);
          break;
        case 'DOSE_REMINDER_DUE':
          void refresh(false).then(() => {
            const target = dosesRef.current.find((d) => d.id === event.doseId);
            if (target?.statut === 'EN_ATTENTE' && (event.relance || !announced.current.has(target.id))) announce(target);
          });
          break;
      }
    },
    [refresh, announce],
  );
  useSeniorEvents(seniorId, onRealtimeEvent);

  // Démarrage : cache local d'abord (écran immédiat même hors ligne), puis serveur.
  useEffect(() => {
    if (!seniorId) return;
    (async () => {
      const cachedProfile = await AsyncStorage.getItem(PROFILE_KEY);
      if (cachedProfile) setProfile(JSON.parse(cachedProfile) as SeniorDto);
      applyDoses(await cachedDoses());
      await configureReminders();
      setAlerts(await getAlertPermissions());
      await refresh();
      const launchDoseId = consumeLaunchReminder();
      if (launchDoseId) playFromNotification(launchDoseId);
      const token = await devicePushToken();
      if (token) seniorApi.registerDevice(token.platform, token.token).catch(() => undefined);
    })();
  }, [seniorId, refresh, applyDoses, playFromNotification]);

  // Retour du réseau ou de l'application au premier plan : synchronisation.
  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void refresh();
      else setOnline(false);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(new Date());
        void getAlertPermissions().then(setAlerts);
        void refresh();
      }
    });
    return () => {
      unsubscribeNet();
      appState.remove();
    };
  }, [refresh]);

  // Horloge : l'audio du rappel se déclenche à l'heure prévue quand l'application est ouverte.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Réveil à l'heure exacte de la prochaine prise, sans attendre le tic de l'horloge.
  useEffect(() => {
    const delay = msUntilNextDue(doses, new Date());
    if (delay === null) return;
    const timer = setTimeout(() => setNow(new Date()), Math.min(delay, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [doses, now]);

  const dose = currentDose(doses, now);

  useEffect(() => {
    const next = doseToAnnounce(doses, now, announced.current);
    if (next) announce(next);
  }, [doses, now, announce]);

  // Notifications : appui sur le rappel, ou réception pendant que l'application est ouverte.
  useEffect(() => onReminderTapped(playFromNotification), [playFromNotification]);
  useEffect(
    () =>
      onReminderReceived((doseId) => {
        const target = dosesRef.current.find((d) => d.id === doseId);
        if (target?.statut === 'EN_ATTENTE' && !announced.current.has(target.id)) announce(target);
      }),
    [announce],
  );

  if (!session || session.kind !== 'senior') return <Redirect href="/" />;

  const onDone = async () => {
    if (!dose || !isConfirmable(dose, now) || busy) return;
    setBusy(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Confirmation silencieuse : la voix du rappel s'arrête, seul l'écran (et la vibration) confirme.
    stopAudio();
    applyDoses(dosesRef.current.map((d) => (d.id === dose.id ? { ...d, statut: 'CONFIRME' } : d)));
    const outcome = await confirmDose(dose);
    setMessage(
      outcome === 'en_attente' ? t.senior.savedOffline : outcome === 'refusee' ? t.senior.alreadyClosed : t.senior.saved,
    );
    setBusy(false);
    void refresh();
  };

  const activateAlerts = async () => {
    setAlerts(await enableAlerts());
    void refresh(false);
  };

  const callContact = () => {
    if (!profile?.contactUrgenceTel) return;
    void Linking.openURL(`tel:${profile.contactUrgenceTel}`);
  };

  const confirmSignOut = () =>
    Alert.alert(
      t.senior.signOutTitle,
      t.senior.signOutText,
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.senior.signOutConfirm, style: 'destructive', onPress: () => void signOut().then(() => router.replace('/')) },
      ],
    );

  const canConfirm = !!dose && isConfirmable(dose, now) && !busy;
  const due = !!dose && isDue(dose, now);
  const hasVoice = hasReminderVoice(dose);
  const alertsMissing = !!alerts && (!alerts.notifications || !alerts.exactAlarms);
  const text = { color: colours.text, fontSize: font };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colours.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <HomeButton variant="senior" colours={colours} font={SENIOR_MIN_FONT} />
        <Pressable onLongPress={confirmSignOut} delayLongPress={3000} accessibilityRole="header">
          <Text style={[styles.greeting, { color: colours.text, fontSize: font + 8 }]}>
            {t.senior.hello(profile?.lien?.surnomSenior ?? session.nomComplet)}
          </Text>
        </Pressable>

        {!online ? (
          <Text style={[styles.offline, { fontSize: font - 4, color: colours.action }]} accessibilityRole="alert">
            {t.senior.offline}
          </Text>
        ) : null}
        {session?.demo ? <Text style={[styles.offline, { fontSize: SENIOR_MIN_FONT, color: colours.muted }]}>{t.demo.badge}</Text> : null}

        {alertsMissing ? (
          <View style={styles.permissions}>
            <Text style={[text, styles.center]} accessibilityRole="alert">
              {t.senior.alertsMissing}
            </Text>
            <BigButton
              label={t.senior.enableAlerts}
              colours={colours}
              font={font}
              onPress={() => void activateAlerts()}
              emphasis
            />
          </View>
        ) : null}

        {due && dose ? (
          <View style={[styles.alert, { backgroundColor: colours.action }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Text style={[styles.alertTitle, { color: colours.actionText, fontSize: font + 12 }]}>{t.senior.timeNow}</Text>
            <Text style={[styles.bold, { color: colours.actionText, fontSize: font }]}>{dose.nomMedicament}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colours.card }, colours === seniorColours.normal && styles.cardNormal]} accessibilityLiveRegion="polite">
          {dose ? (
            <>
              <Text style={[styles.time, { color: colours.action, fontSize: font + 24 }]}>{formatTime(dose.datePrevue)}</Text>
              <Text style={[text, styles.bold]}>{due ? t.senior.dueTitle : t.senior.next}</Text>
              <Text style={[text, styles.medication]}>{dose.nomMedicament}</Text>
              {dose.consigne ? <Text style={[text, { color: colours.muted }]}>{dose.consigne}</Text> : null}
            </>
          ) : (
            <Text style={[text, styles.center]}>{t.senior.none}</Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.senior.done}
          accessibilityHint={t.senior.doneHint}
          accessibilityState={{ disabled: !canConfirm }}
          disabled={!canConfirm}
          onPress={onDone}
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: colours.action, opacity: canConfirm ? (pressed ? 0.8 : 1) : 0.35 },
          ]}
        >
          <Text style={[styles.doneText, { color: colours.actionText, fontSize: font + 16 }]}>{t.senior.done}</Text>
        </Pressable>

        {message ? (
          <Text style={[text, styles.center]} accessibilityRole="alert">
            {message}
          </Text>
        ) : null}

        {dose && hasVoice ? (
          <BigButton label={due ? t.senior.replay : t.senior.listen} colours={colours} font={font} onPress={() => void playReminder(dose)} />
        ) : null}
        {due && !hasVoice ? <Text style={[text, styles.center]}>{t.senior.noVoice}</Text> : null}
        <BigButton label={t.senior.memoryGame} colours={colours} font={font} onPress={() => router.push('/senior/exercise')} />
        {profile?.contactUrgenceTel ? (
          <BigButton
            label={t.senior.call(profile.contactUrgenceNom ?? t.senior.defaultContact)}
            colours={colours}
            font={font}
            onPress={callContact}
            emphasis
          />
        ) : null}
        <BigButton label={t.senior.signOut} colours={colours} font={font} onPress={confirmSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BigButton({
  label,
  onPress,
  colours,
  font,
  emphasis,
}: {
  label: string;
  onPress: () => void;
  colours: (typeof seniorColours)['high'];
  font: number;
  emphasis?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigButton,
        { borderColor: emphasis ? colours.action : colours.text, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: emphasis ? colours.action : colours.text, fontSize: font, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 18 },
  greeting: { fontWeight: '800' },
  offline: { fontWeight: '700' },
  permissions: { gap: 10 },
  alert: { borderRadius: 24, padding: 20, gap: 4, alignItems: 'center' },
  alertTitle: { fontWeight: '900', textAlign: 'center' },
  card: { borderRadius: 24, padding: 22, gap: 6, alignItems: 'center' },
  cardNormal: { borderWidth: 1, borderColor: '#E6EEF8', ...shadow },
  time: { fontWeight: '900' },
  bold: { fontWeight: '700', textAlign: 'center' },
  medication: { fontWeight: '800', textAlign: 'center' },
  center: { textAlign: 'center' },
  doneButton: { minHeight: MIN_TOUCH * 2, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontWeight: '900' },
  bigButton: { minHeight: MIN_TOUCH * 1.25, borderRadius: 20, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
