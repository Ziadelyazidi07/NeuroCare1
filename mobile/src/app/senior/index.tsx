/**
 * Écran principal du senior (cahier §2.1, ENF-08) : un seul écran, police ≥ 24 sp, contraste élevé,
 * gros bouton « C'est fait » ≥ 64 dp, audio pour chaque action. Fonctionne hors ligne.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

import { seniorApi } from '../../api/api';
import type { DoseDto, Language, SeniorDto } from '../../api/types';
import { useSession } from '../../auth/SessionContext';
import { formatTime } from '../../lib/dates';
import { currentDose, isConfirmable, isDue } from '../../lib/doses';
import { confirmDose, refreshDoses, cachedDoses } from '../../senior/offlineStore';
import { playReminder, playThanks, prefetchReminderAudio } from '../../senior/reminderAudio';
import { configureReminders, devicePushToken, onReminderTapped, scheduleReminders } from '../../senior/reminders';
import { MIN_TOUCH, SENIOR_MIN_FONT, seniorColours } from '../../ui/theme';

const PROFILE_KEY = 'neurocare.senior.profile';

export default function SeniorHome() {
  const { session, signOut } = useSession();
  const [profile, setProfile] = useState<SeniorDto | null>(null);
  const [doses, setDoses] = useState<DoseDto[]>([]);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const announced = useRef(new Set<string>());

  const seniorId = session?.kind === 'senior' ? session.seniorId : undefined;
  const language: Language = profile?.langue ?? 'DARIJA';
  const colours = profile?.contrasteEleve === false ? seniorColours.normal : seniorColours.high;
  const font = Math.max(SENIOR_MIN_FONT, profile?.taillePolice ?? 28);

  const refresh = useCallback(async () => {
    if (!seniorId) return;
    try {
      const result = await refreshDoses();
      setDoses(result.doses);
      setOnline(result.online);
      await scheduleReminders(result.doses);
      if (result.online) {
        const fresh = await seniorApi.profile(seniorId);
        setProfile(fresh);
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
        await prefetchReminderAudio(result.doses);
      }
    } catch {
      setOnline(false);
    }
  }, [seniorId]);

  // Démarrage : cache local d'abord (écran immédiat même hors ligne), puis serveur.
  useEffect(() => {
    if (!seniorId) return;
    (async () => {
      const cachedProfile = await AsyncStorage.getItem(PROFILE_KEY);
      if (cachedProfile) setProfile(JSON.parse(cachedProfile) as SeniorDto);
      setDoses(await cachedDoses());
      await configureReminders();
      await refresh();
      const token = await devicePushToken();
      if (token) seniorApi.registerDevice(token.platform, token.token).catch(() => undefined);
    })();
  }, [seniorId, refresh]);

  // Retour du réseau ou de l'application au premier plan : synchronisation.
  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void refresh();
      else setOnline(false);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
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

  const dose = currentDose(doses, now);

  useEffect(() => {
    if (dose && isDue(dose, now) && !announced.current.has(dose.id)) {
      announced.current.add(dose.id);
      void playReminder(dose, language);
    }
  }, [dose, now, language]);

  // Notification touchée : on joue le message de la prise concernée.
  useEffect(() => {
    return onReminderTapped((doseId) => {
      const target = doses.find((d) => d.id === doseId) ?? dose;
      announced.current.add(String(doseId));
      void playReminder(target ?? null, language);
    });
  }, [doses, dose, language]);

  if (!session || session.kind !== 'senior') return <Redirect href="/" />;

  const onDone = async () => {
    if (!dose || !isConfirmable(dose, now) || busy) return;
    setBusy(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void playThanks(language);
    setDoses((list) => list.map((d) => (d.id === dose.id ? { ...d, statut: 'CONFIRME' } : d)));
    const outcome = await confirmDose(dose);
    setMessage(
      outcome === 'en_attente'
        ? "C'est noté. Ce sera envoyé dès que le téléphone aura du réseau."
        : outcome === 'refusee'
          ? 'Ce rappel était déjà clôturé.'
          : "C'est noté. Merci !",
    );
    setBusy(false);
    void refresh();
  };

  const callContact = () => {
    if (!profile?.contactUrgenceTel) return;
    void Linking.openURL(`tel:${profile.contactUrgenceTel}`);
  };

  const confirmUnpair = () =>
    Alert.alert('Désappairer ce téléphone ?', 'Il faudra un nouveau code de votre proche.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Désappairer', style: 'destructive', onPress: () => void signOut().then(() => router.replace('/')) },
    ]);

  const canConfirm = !!dose && isConfirmable(dose, now) && !busy;
  const due = !!dose && isDue(dose, now);
  const text = { color: colours.text, fontSize: font };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colours.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onLongPress={confirmUnpair} delayLongPress={3000} accessibilityRole="header">
          <Text style={[styles.greeting, { color: colours.text, fontSize: font + 8 }]}>
            Bonjour {profile?.lien?.surnomSenior ?? session.nomComplet}
          </Text>
        </Pressable>

        {!online ? (
          <Text style={[styles.offline, { fontSize: font - 4, color: colours.action }]} accessibilityRole="alert">
            Pas de réseau : vos rappels continuent et vos réponses seront envoyées plus tard.
          </Text>
        ) : null}

        <View style={[styles.card, { backgroundColor: colours.card }]} accessibilityLiveRegion="polite">
          {dose ? (
            <>
              <Text style={[styles.time, { color: colours.action, fontSize: font + 24 }]}>{formatTime(dose.datePrevue)}</Text>
              <Text style={[text, styles.bold]}>{due ? "C'est l'heure de ton médicament" : 'Prochain rappel'}</Text>
              <Text style={[text, styles.medication]}>{dose.nomMedicament}</Text>
              {dose.consigne ? <Text style={[text, { color: colours.muted }]}>{dose.consigne}</Text> : null}
            </>
          ) : (
            <Text style={text}>Aucun rappel pour le moment.</Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="C'est fait"
          accessibilityHint="Confirme le rappel de médicament"
          accessibilityState={{ disabled: !canConfirm }}
          disabled={!canConfirm}
          onPress={onDone}
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: colours.action, opacity: canConfirm ? (pressed ? 0.8 : 1) : 0.35 },
          ]}
        >
          <Text style={[styles.doneText, { color: colours.actionText, fontSize: font + 16 }]}>C’est fait</Text>
        </Pressable>

        {message ? (
          <Text style={[text, styles.center]} accessibilityRole="alert">
            {message}
          </Text>
        ) : null}

        {dose ? (
          <BigButton label="Écouter le message" colours={colours} font={font} onPress={() => void playReminder(dose, language)} />
        ) : null}
        <BigButton label="Jeu de mémoire" colours={colours} font={font} onPress={() => router.push('/senior/exercise')} />
        {profile?.contactUrgenceTel ? (
          <BigButton
            label={`Appeler ${profile.contactUrgenceNom ?? 'mon proche'}`}
            colours={colours}
            font={font}
            onPress={callContact}
            emphasis
          />
        ) : null}
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
      <Text style={{ color: emphasis ? colours.action : colours.text, fontSize: font, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 18 },
  greeting: { fontWeight: '800' },
  offline: { fontWeight: '700' },
  card: { borderRadius: 20, padding: 20, gap: 6, alignItems: 'center' },
  time: { fontWeight: '900' },
  bold: { fontWeight: '700', textAlign: 'center' },
  medication: { fontWeight: '800', textAlign: 'center' },
  center: { textAlign: 'center' },
  doneButton: { minHeight: MIN_TOUCH * 2, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontWeight: '900' },
  bigButton: { minHeight: MIN_TOUCH * 1.25, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
