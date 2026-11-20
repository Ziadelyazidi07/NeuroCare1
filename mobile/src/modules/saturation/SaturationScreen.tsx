/**
 * Module 2 — Saturation en oxygène : profil respiratoire, mesure au repos avec alerte immédiate et
 * orientation, historique et relevé PDF nominatif. Accès direct, sans compte : tout reste sur le téléphone.
 * Pré-dépistage, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeButton } from '../../ui/HomeButton';
import { Button, Card, ErrorText, Field, Loading, Notice, styles as ui } from '../../ui/components';
import { MIN_TOUCH, aidantColours as c } from '../../ui/theme';
import { PatientNameField, displayName, usePatientName } from '../PatientName';
import { NOT_A_DIAGNOSIS, formatDateTime, sharePdf } from '../pdf';
import { EmergencyButtons } from '../ui';
import { saturationModule } from './module';
import { PROFILE_QUESTION, parseMeasurement, profileLabel, spo2Advice, type Spo2Level } from './spo2';
import { spo2ReportHtml } from './spo2Pdf';
import { addMeasure, loadMeasures, loadProfile, saveProfile, type Spo2Measurement } from './spo2Store';

const LEVEL_COLOUR: Record<Spo2Level, { bg: string; fg: string }> = {
  VERT: { bg: '#E6F4EA', fg: '#1E7B34' },
  ORANGE: { bg: '#FEF3E0', fg: '#8A4600' },
  ROUGE: { bg: '#B3261E', fg: '#FFFFFF' },
};

export default function SaturationScreen() {
  const [name, setName] = usePatientName();
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          {saturationModule.title}
        </Text>
        <PatientNameField value={name} onChange={setName} />
        <Spo2Panel patient={displayName(name)} />
        <Notice>{NOT_A_DIAGNOSIS}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

function Spo2Panel({ patient }: { patient: string }) {
  const [chronic, setChronic] = useState<boolean | null | undefined>(undefined); // undefined = chargement
  const [editingProfile, setEditingProfile] = useState(false);
  const [history, setHistory] = useState<Spo2Measurement[] | null>(null);
  const [spo2, setSpo2] = useState('');
  const [pouls, setPouls] = useState('');
  const [last, setLast] = useState<Spo2Measurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profile, measures] = await Promise.all([loadProfile(), loadMeasures()]);
    setChronic(profile);
    setHistory(measures);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const chooseProfile = async (value: boolean) => {
    setChronic(value);
    setEditingProfile(false);
    try {
      await saveProfile(value);
    } catch {
      setError('Profil non mémorisé sur ce téléphone.');
    }
  };

  const submit = async () => {
    if (chronic == null) return;
    const parsed = parseMeasurement(spo2, pouls);
    if (typeof parsed === 'string') {
      setError(parsed);
      return;
    }
    setError(null);
    try {
      const saved = await addMeasure(parsed, chronic);
      setLast(saved);
      setHistory((list) => [saved, ...(list ?? [])]);
      setSpo2('');
      setPouls('');
    } catch {
      setError('Mesure non mémorisée sur ce téléphone.');
    }
  };

  const downloadPdf = async () => {
    if (chronic == null || !history) return;
    setError(null);
    try {
      await sharePdf(spo2ReportHtml(patient, chronic, history, new Date()), 'Relevé SpO2 NeuroCare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF impossible à créer.');
    }
  };

  if (chronic === undefined) return <Loading />;

  if (chronic === null || editingProfile) {
    return (
      <Card title="Profil respiratoire">
        <Text style={ui.text}>{PROFILE_QUESTION}</Text>
        <View style={styles.choices}>
          <ChoiceButton label="Oui" onPress={() => void chooseProfile(true)} />
          <ChoiceButton label="Non" onPress={() => void chooseProfile(false)} />
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
        <Button label="Enregistrer la mesure" onPress={() => void submit()} disabled={!spo2 || !pouls} />
        <ErrorText message={error} />
      </Card>

      {last ? <AlertCard measure={last} /> : null}

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

function AlertCard({ measure }: { measure: Spo2Measurement }) {
  const advice = spo2Advice(measure.niveau, measure.maladieRespiratoireChronique);
  const colour = LEVEL_COLOUR[measure.niveau];
  return (
    <View style={[styles.alert, { backgroundColor: colour.bg, borderColor: colour.fg }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={ui.row}>
        <Ionicons name={measure.niveau === 'VERT' ? 'checkmark-circle' : 'warning'} size={28} color={colour.fg} />
        <Text style={[styles.alertTitle, { color: colour.fg }]}>{advice.title}</Text>
      </View>
      <Text style={[styles.alertValue, { color: colour.fg }]}>
        SpO2 {measure.spo2} % · Pouls {measure.pouls} bpm
      </Text>
      <Text style={{ color: colour.fg, fontSize: 16 }}>{advice.message}</Text>
      {measure.niveau === 'ROUGE' ? <EmergencyButtons /> : null}
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

function ChoiceButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.6 }]}>
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
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
});
