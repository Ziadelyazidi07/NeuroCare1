/**
 * Module 2 — Saturation en oxygène : profil respiratoire, mesure au repos avec alerte immédiate et
 * orientation, historique et relevé PDF nominatif. Accès direct, sans compte : tout reste sur le téléphone.
 * Pré-dépistage, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useLanguage } from '../../i18n';
import { Badge, Button, Card, ErrorText, Field, Loading, MIN_TOUCH, Notice, Row, Text, colours as c, levelColours, radius, styles as ui } from '../../theme';
import { ModuleScreen } from '../ModuleScreen';
import { formatDateTime, sharePdf } from '../pdf';
import { EmergencyButtons } from '../ui';
import { saturationModule } from './module';
import { PULSE_MAX, PULSE_MIN, SPO2_MAX, SPO2_MIN, parseMeasurement, type Spo2Level } from './spo2';
import { spo2ReportHtml } from './spo2Pdf';
import { addMeasure, loadMeasures, loadProfile, saveProfile, type Spo2Measurement } from './spo2Store';

export default function SaturationScreen() {
  return <ModuleScreen module={saturationModule}>{(patient) => <Spo2Panel patient={patient} />}</ModuleScreen>;
}

function Spo2Panel({ patient }: { patient: string }) {
  const { t, row } = useLanguage();
  const s = t.spo2;
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
      setError(s.errors.profileNotSaved);
    }
  };

  const submit = async () => {
    if (chronic == null) return;
    const parsed = parseMeasurement(spo2, pouls);
    if (parsed === 'SPO2' || parsed === 'PULSE') {
      setError(parsed === 'SPO2' ? s.errors.spo2(SPO2_MIN, SPO2_MAX) : s.errors.pulse(PULSE_MIN, PULSE_MAX));
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
      setError(s.errors.measureNotSaved);
    }
  };

  const downloadPdf = async () => {
    if (chronic == null || !history) return;
    setError(null);
    try {
      await sharePdf(t, spo2ReportHtml(t, patient, chronic, history, new Date()), s.pdf.dialog);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shared.pdfFailed);
    }
  };

  if (chronic === undefined) return <Loading />;

  if (chronic === null || editingProfile) {
    return (
      <Card title={s.profileTitle} icon="fitness">
        <Text style={ui.text}>{s.profileQuestion}</Text>
        <View style={[styles.choices, row]}>
          <ChoiceButton label={t.common.yes} onPress={() => void chooseProfile(true)} />
          <ChoiceButton label={t.common.no} onPress={() => void chooseProfile(false)} />
        </View>
        <Text style={ui.muted}>{s.profileHelp}</Text>
        {editingProfile ? <Button label={t.common.cancel} variant="secondary" onPress={() => setEditingProfile(false)} /> : null}
        <ErrorText message={error} />
      </Card>
    );
  }

  return (
    <>
      <Card
        title={s.profileTitle}
        icon="fitness"
        right={
          <Pressable accessibilityRole="button" onPress={() => setEditingProfile(true)} hitSlop={8}>
            <Text style={styles.link}>{t.common.edit}</Text>
          </Pressable>
        }
      >
        <Text style={ui.text}>{s.profileLabel(chronic)}</Text>
      </Card>

      <Card title={s.newMeasure} icon="pulse">
        <Text style={ui.muted}>{s.measureHelp}</Text>
        <Field label={s.spo2Field} value={spo2} onChangeText={setSpo2} keyboardType="number-pad" maxLength={3} placeholder="97" />
        <Field label={s.pulseField} value={pouls} onChangeText={setPouls} keyboardType="number-pad" maxLength={3} placeholder="72" />
        <Button label={s.save} onPress={() => void submit()} disabled={!spo2 || !pouls} />
        <ErrorText message={error} />
      </Card>

      {last ? <AlertCard measure={last} /> : null}

      <Card title={t.shared.history} icon="time">
        {history === null ? <Loading /> : null}
        {history?.length === 0 ? <Text style={ui.muted}>{s.noMeasure}</Text> : null}
        {history?.map((m) => (
          <Row key={m.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(m.dateMesure)}</Text>
              <Text style={ui.muted}>{s.measureLine(m.spo2, m.pouls)}</Text>
            </View>
            <LevelBadge level={m.niveau} />
          </Row>
        ))}
        <Button label={s.download} variant="secondary" icon="document-text" onPress={() => void downloadPdf()} disabled={!history} />
      </Card>

      <Notice>{s.orientation}</Notice>
    </>
  );
}

function AlertCard({ measure }: { measure: Spo2Measurement }) {
  const { t } = useLanguage();
  const advice = t.spo2.advice(measure.niveau, measure.maladieRespiratoireChronique);
  const colour = levelColours[measure.niveau];
  return (
    <View style={[styles.alert, { backgroundColor: colour.bg, borderColor: colour.fg }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Row>
        <Ionicons name={measure.niveau === 'VERT' ? 'checkmark-circle' : 'warning'} size={28} color={colour.fg} />
        <Text style={[styles.alertTitle, { color: colour.fg }]}>{advice.title}</Text>
      </Row>
      <Text style={[styles.alertValue, { color: colour.fg }]}>{t.spo2.measureLine(measure.spo2, measure.pouls)}</Text>
      <Text style={[ui.text, { color: colour.fg }]}>{advice.message}</Text>
      {measure.niveau === 'ROUGE' ? <EmergencyButtons /> : null}
    </View>
  );
}

function LevelBadge({ level }: { level: Spo2Level }) {
  const { t } = useLanguage();
  const colour = level === 'ROUGE' ? { bg: c.dangerSoft, fg: c.danger } : levelColours[level];
  return <Badge label={t.spo2.level[level]} colours={colour} />;
}

function ChoiceButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && { opacity: 0.6 }]}>
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: c.primary, fontWeight: '700', fontSize: 17 },
  choices: { gap: 12 },
  choice: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.control, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  choiceText: { color: c.primaryText, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  alert: { borderWidth: 2, borderRadius: radius.card, padding: 18, gap: 10 },
  alertTitle: { fontSize: 21, fontWeight: '800', flex: 1 },
  alertValue: { fontSize: 19, fontWeight: '700' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
});
