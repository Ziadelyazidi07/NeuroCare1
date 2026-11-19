/**
 * Module 2 — Saturation en oxygène : profil respiratoire, mesure au repos avec alerte immédiate et
 * orientation, historique et relevé PDF nominatif. Pré-dépistage, jamais un diagnostic.
 */
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '../../lib/problem';
import { HomeButton } from '../../ui/HomeButton';
import { Button, Card, ErrorText, Field, Loading, Notice, styles as ui } from '../../ui/components';
import { MIN_TOUCH, aidantColours as c } from '../../ui/theme';
import { PatientGate, type Patient } from '../PatientGate';
import { NOT_A_DIAGNOSIS, formatDateTime, sharePdf } from '../pdf';
import { saturationModule } from './module';
import {
  EMERGENCY_NUMBERS,
  PROFILE_QUESTION,
  classifySpo2,
  parseMeasurement,
  profileLabel,
  spo2Advice,
  type Spo2Level,
} from './spo2';
import { spo2Api, type Spo2MeasurementDto } from './spo2Api';
import { spo2ReportHtml } from './spo2Pdf';

const LEVEL_COLOUR: Record<Spo2Level, { bg: string; fg: string }> = {
  VERT: { bg: '#E6F4EA', fg: '#1E7B34' },
  ORANGE: { bg: '#FEF3E0', fg: '#8A4600' },
  ROUGE: { bg: '#B3261E', fg: '#FFFFFF' },
};

export default function SaturationScreen() {
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          {saturationModule.title}
        </Text>
        <PatientGate>{(patient) => <Spo2Panel key={patient.seniorId} patient={patient} />}</PatientGate>
        <Notice>{NOT_A_DIAGNOSIS}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

interface LastResult {
  spo2: number;
  pouls: number;
  chronic: boolean;
  level: Spo2Level;
  saved: boolean;
}

function Spo2Panel({ patient }: { patient: Patient }) {
  const [chronic, setChronic] = useState<boolean | null | undefined>(undefined); // undefined = chargement
  const [editingProfile, setEditingProfile] = useState(false);
  const [history, setHistory] = useState<Spo2MeasurementDto[] | null>(null);
  const [spo2, setSpo2] = useState('');
  const [pouls, setPouls] = useState('');
  const [last, setLast] = useState<LastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await spo2Api.history(patient.seniorId)).mesures);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [patient.seniorId]);

  useEffect(() => {
    spo2Api
      .profile(patient.seniorId)
      .then((p) => setChronic(p.maladieRespiratoireChronique ?? null))
      .catch((e) => {
        setChronic(null);
        setError(errorMessage(e));
      });
  }, [patient.seniorId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const chooseProfile = async (value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await spo2Api.setProfile(patient.seniorId, value);
      setChronic(saved.maladieRespiratoireChronique ?? value);
      setEditingProfile(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (chronic == null) return;
    const parsed = parseMeasurement(spo2, pouls);
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }
    // L'alerte s'affiche immédiatement, même si l'enregistrement échoue (réseau).
    setLast({ ...parsed, chronic, level: classifySpo2(parsed.spo2, chronic), saved: false });
    setBusy(true);
    setError(null);
    try {
      const saved = await spo2Api.record(patient.seniorId, parsed);
      setLast({ ...parsed, chronic: saved.maladieRespiratoireChronique, level: saved.niveau, saved: true });
      setSpo2('');
      setPouls('');
      await loadHistory();
    } catch (e) {
      setError(`Mesure non enregistrée : ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (chronic == null || !history) return;
    setError(null);
    try {
      await sharePdf(spo2ReportHtml(patient.nom, chronic, history, new Date()), 'Relevé SpO2 NeuroCare');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (chronic === undefined) return <Loading />;

  if (chronic === null || editingProfile) {
    return (
      <Card title="Profil respiratoire">
        <Text style={ui.text}>{PROFILE_QUESTION}</Text>
        <View style={styles.choices}>
          <ChoiceButton label="Oui" onPress={() => void chooseProfile(true)} disabled={busy} />
          <ChoiceButton label="Non" onPress={() => void chooseProfile(false)} disabled={busy} />
        </View>
        <Text style={ui.muted}>Oui : cible 88-92 % (BPCO, insuffisance respiratoire). Non : cible standard 95-100 %.</Text>
        {editingProfile ? <Button label="Annuler" variant="secondary" onPress={() => setEditingProfile(false)} /> : null}
        <ErrorText message={error} />
      </Card>
    );
  }

  return (
    <>
      <Card
        title="Profil respiratoire"
        right={
          <Pressable accessibilityRole="button" onPress={() => setEditingProfile(true)} hitSlop={8}>
            <Text style={{ color: c.primary, fontWeight: '600' }}>Modifier</Text>
          </Pressable>
        }
      >
        <Text style={ui.text}>{profileLabel(chronic)}</Text>
      </Card>

      <Card title="Nouvelle mesure au repos">
        <Text style={ui.muted}>Patient assis, au calme depuis 5 minutes, main au chaud, sans vernis sur le doigt mesuré.</Text>
        <Field label="SpO2 (%)" value={spo2} onChangeText={setSpo2} keyboardType="number-pad" maxLength={3} placeholder="97" />
        <Field label="Pouls (bpm)" value={pouls} onChangeText={setPouls} keyboardType="number-pad" maxLength={3} placeholder="72" />
        <Button label="Enregistrer la mesure" onPress={() => void submit()} loading={busy} disabled={!spo2 || !pouls} />
        <ErrorText message={error} />
      </Card>

      {last ? <AlertCard result={last} /> : null}

      <Card title="Historique">
        {history === null ? <Loading /> : null}
        {history?.length === 0 ? <Text style={ui.muted}>Aucune mesure pour le moment.</Text> : null}
        {history?.map((m) => (
          <View key={m.id} style={styles.historyRow}>
            <Text style={[ui.text, { flex: 1 }]}>
              {formatDateTime(m.dateMesure)} · {m.spo2} % · {m.pouls} bpm
            </Text>
            <LevelBadge level={m.niveau} />
          </View>
        ))}
        <Button label="Télécharger le relevé SpO2 PDF" variant="secondary" onPress={() => void downloadPdf()} disabled={!history} />
      </Card>

      <Notice>
        Orientation : en cas d’essoufflement important, de douleur thoracique, de lèvres bleutées ou de confusion, appelez
        les urgences (15 ou 141) quelle que soit la mesure.
      </Notice>
    </>
  );
}

function AlertCard({ result }: { result: LastResult }) {
  const advice = spo2Advice(result.level, result.chronic);
  const colour = LEVEL_COLOUR[result.level];
  return (
    <View style={[styles.alert, { backgroundColor: colour.bg, borderColor: colour.fg }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={ui.row}>
        <Ionicons name={result.level === 'VERT' ? 'checkmark-circle' : 'warning'} size={28} color={colour.fg} />
        <Text style={[styles.alertTitle, { color: colour.fg }]}>{advice.title}</Text>
      </View>
      <Text style={[styles.alertValue, { color: colour.fg }]}>
        SpO2 {result.spo2} % · Pouls {result.pouls} bpm
      </Text>
      <Text style={{ color: colour.fg, fontSize: 16 }}>{advice.message}</Text>
      {result.level === 'ROUGE'
        ? EMERGENCY_NUMBERS.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Appeler le ${n}`}
              onPress={() => void Linking.openURL(`tel:${n}`)}
              style={({ pressed }) => [styles.emergency, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="call" size={24} color="#B3261E" />
              <Text style={styles.emergencyText}>Appeler le {n}</Text>
            </Pressable>
          ))
        : null}
      {!result.saved ? <Text style={{ color: colour.fg, fontSize: 14 }}>Enregistrement en cours ou impossible.</Text> : null}
    </View>
  );
}

function LevelBadge({ level }: { level: Spo2Level }) {
  const label = level === 'VERT' ? 'Vert' : level === 'ORANGE' ? 'Orange' : 'Rouge';
  const colour = LEVEL_COLOUR[level];
  return (
    <View style={[styles.badge, { backgroundColor: colour.bg, borderColor: colour.fg }]}>
      <Text style={{ color: colour.fg, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function ChoiceButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  choices: { flexDirection: 'row', gap: 12 },
  choice: { flex: 1, minHeight: MIN_TOUCH, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  choiceText: { color: c.primaryText, fontSize: 24, fontWeight: '800' },
  alert: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 10 },
  alertTitle: { fontSize: 20, fontWeight: '800', flex: 1 },
  alertValue: { fontSize: 18, fontWeight: '700' },
  emergency: {
    minHeight: MIN_TOUCH,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emergencyText: { color: '#B3261E', fontSize: 22, fontWeight: '800' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
});
