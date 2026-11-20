/**
 * Module 5 — Cardio-vasculaire : alerte immédiate à chaque mesure (même hors ligne), check-list de
 * symptômes en urgence, protocole d'automesure sur 3 jours (18 mesures) avec moyenne et relevé PDF.
 * Accès direct, sans compte : tout reste sur le téléphone. Pré-dépistage et orientation, jamais un diagnostic.
 */
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useLanguage } from '../../i18n';
import { toIsoDate } from '../../lib/dates';
import { Badge, Button, Card, Checkbox, ErrorText, Field, Loading, Row, Text, colours as c, radius, styles as ui } from '../../theme';
import { MeasurementGuideCard } from '../MeasurementGuideCard';
import { ModuleScreen } from '../ModuleScreen';
import { formatDateTime, sharePdf } from '../pdf';
import { EmergencyButtons } from '../ui';
import {
  PROTOCOL_SIZE,
  SYMPTOMS,
  averageOf,
  classifyBp,
  formatAverage,
  nextEmptySlot,
  parseBp,
  protocolDay,
  slotKey,
  slotLabel,
  type BpLevel,
  type BpValues,
  type Slot,
  type Symptom,
} from './bp';
import { addMeasure, loadMeasures, loadSeries, recordSlot, startSeries, type BpMeasurement, type BpSeries } from './bpStore';
import { bpReportHtml } from './bpPdf';
import { cardioModule } from './module';

const LEVEL_COLOUR: Record<BpLevel, { bg: string; fg: string }> = {
  URGENCE_HYPERTENSIVE: { bg: '#C62828', fg: '#FFFFFF' },
  HYPOTENSION: { bg: '#FEF3C7', fg: '#8A4600' },
  TENSION_ELEVEE: { bg: '#FEF3C7', fg: '#8A4600' },
  NORMALE: { bg: '#DCFCE7', fg: '#14653A' },
};

export default function CardioScreen() {
  return (
    <ModuleScreen module={cardioModule} guide={<MeasurementGuideCard module={cardioModule} device="tensiometer" guide={(t) => t.bp.guide} />}>
      {(patient) => <CardioPanel patient={patient} />}
    </ModuleScreen>
  );
}

interface LastResult extends BpValues {
  level: BpLevel;
  saved: boolean;
  /** Créneau du protocole, ou null pour une mesure ponctuelle. */
  slot: Slot | null;
}

function CardioPanel({ patient }: { patient: string }) {
  const { t } = useLanguage();
  const b = t.bp;
  const [series, setSeries] = useState<BpSeries[] | null>(null);
  const [history, setHistory] = useState<BpMeasurement[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, h] = await Promise.all([loadSeries(), loadMeasures()]);
    setSeries(s);
    setHistory(h);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const current = series?.[0] ?? null;
  const currentComplete = !!current && current.mesures.length >= PROTOCOL_SIZE;
  const active = current && !currentComplete ? current : null;
  const slot = active ? (selected ?? nextEmptySlot(active.mesures)) : null;

  const save = async (values: BpValues, target: { serieId: string; slot: Slot } | null): Promise<boolean> => {
    const result = { ...values, level: classifyBp(values.tas, values.tad), slot: target?.slot ?? null };
    // L'alerte s'affiche immédiatement, avant même la mémorisation sur le téléphone.
    setLast({ ...result, saved: false });
    setError(null);
    try {
      if (target) await recordSlot(target.serieId, target.slot, values);
      else await addMeasure(values);
      setLast({ ...result, saved: true });
      setSelected(null);
      await load();
      return true;
    } catch {
      setError(b.measureNotSaved);
      return false;
    }
  };

  const startProtocol = async () => {
    setError(null);
    try {
      await startSeries(toIsoDate(new Date()));
      setSelected(null);
      await load();
    } catch {
      setError(b.protocolNotCreated);
    }
  };

  const downloadPdf = async (s: BpSeries) => {
    setError(null);
    try {
      const now = new Date();
      await sharePdf(t, bpReportHtml(t, patient, s, now), { dialogTitle: b.pdf.dialog, module: 'cardio', patient, generatedAt: now });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shared.pdfFailed);
    }
  };

  if (series === null) return <Loading />;

  const avg = current ? averageOf(current.mesures) : null;

  return (
    <>
      {last ? <AlertCard key={`${last.slot ? slotKey(last.slot) : 'spot'}-${last.tas}-${last.tad}`} result={last} /> : null}
      <ErrorText message={error} />

      <Card title={b.protocolTitle} icon="calendar">
        {b.instructions.map((line) => (
          <Text key={line} style={ui.muted}>
            • {line}
          </Text>
        ))}
        {current ? <ProtocolGrid series={current} selected={slot} onSelect={active ? setSelected : undefined} /> : null}

        {avg && current ? (
          <View
            style={[styles.average, { borderColor: avg.elevated ? c.warning : c.success }]}
            accessibilityRole={currentComplete ? 'alert' : 'text'}
          >
            <Text style={[ui.text, { fontWeight: '700' }]}>
              {currentComplete ? b.averageComplete(formatAverage(avg, b.mmHg)) : b.averagePartial(avg.count, PROTOCOL_SIZE, formatAverage(avg, b.mmHg))}
            </Text>
            {currentComplete && avg.elevated ? <Text style={[ui.text, { color: c.warning }]}>{b.averageElevated}</Text> : null}
            {currentComplete && !avg.elevated ? <Text style={[ui.text, { color: c.success }]}>{b.averageNormal}</Text> : null}
          </View>
        ) : null}

        {active && slot ? (
          <>
            <Text style={[ui.text, { fontWeight: '700' }]}>{b.entry(slotLabel(t, slot), protocolDay(active.dateDebut, slot.jour - 1))}</Text>
            {slot.rang > 1 ? <RestTimer /> : null}
            <BpForm key={slotKey(slot)} submitLabel={b.saveSlot(slotLabel(t, slot))} onSubmit={(values) => save(values, { serieId: active.id, slot })} />
          </>
        ) : (
          <Button label={current ? b.startNew : b.start} variant={current ? 'secondary' : 'primary'} onPress={() => void startProtocol()} />
        )}
        {current && current.mesures.length > 0 ? (
          <Button label={b.download} variant="secondary" icon="document-text" onPress={() => void downloadPdf(current)} />
        ) : null}
      </Card>

      <Card title={b.spotTitle} icon="heart">
        <BpForm submitLabel={b.saveMeasure} onSubmit={(values) => save(values, null)} />
        {history && history.length > 0 ? <Text style={[ui.text, { fontWeight: '700' }]}>{b.lastMeasures}</Text> : null}
        {history?.slice(0, 10).map((m) => (
          <Row key={m.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(m.dateMesure)}</Text>
              <Text style={ui.muted}>{b.historyLine(m.tas, m.tad, m.pouls)}</Text>
            </View>
            <LevelBadge level={m.niveau} />
          </Row>
        ))}
      </Card>
    </>
  );
}

function BpForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (v: BpValues) => Promise<boolean> }) {
  const { t, row } = useLanguage();
  const [tas, setTas] = useState('');
  const [tad, setTad] = useState('');
  const [pouls, setPouls] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = parseBp(tas, tad, pouls);
    if (typeof parsed === 'string') {
      setError(t.bp.errors[parsed]);
      return;
    }
    setError(null);
    if (await onSubmit(parsed)) {
      setTas('');
      setTad('');
      setPouls('');
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.inputs, row]}>
        <View style={styles.input}>
          <Field label={t.bp.tas} value={tas} onChangeText={setTas} keyboardType="number-pad" maxLength={3} placeholder="128" />
        </View>
        <View style={styles.input}>
          <Field label={t.bp.tad} value={tad} onChangeText={setTad} keyboardType="number-pad" maxLength={3} placeholder="78" />
        </View>
      </View>
      <Field label={t.bp.pulse} value={pouls} onChangeText={setPouls} keyboardType="number-pad" maxLength={3} placeholder="70" />
      <ErrorText message={error} />
      <Button label={submitLabel} onPress={() => void submit()} disabled={!tas || !tad || !pouls} />
    </View>
  );
}

function AlertCard({ result }: { result: LastResult }) {
  const { t } = useLanguage();
  const b = t.bp;
  const [checked, setChecked] = useState<Symptom[]>([]);
  const advice = b.advice[result.level];
  const colour = LEVEL_COLOUR[result.level];
  const urgent = result.level === 'URGENCE_HYPERTENSIVE';
  const label = result.slot ? slotLabel(t, result.slot) : b.spotTitle;

  return (
    <View style={[styles.alert, { backgroundColor: colour.bg, borderColor: colour.fg }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Row>
        <Ionicons name={result.level === 'NORMALE' ? 'checkmark-circle' : 'warning'} size={28} color={colour.fg} />
        <Text style={[styles.alertTitle, { color: colour.fg }]}>{advice.title}</Text>
      </Row>
      <Text style={[styles.alertValue, { color: colour.fg }]}>{b.alertValue(label, result.tas, result.tad, result.pouls)}</Text>
      <Text style={[ui.text, { color: colour.fg }]}>{advice.message}</Text>
      {result.level === 'NORMALE' || result.level === 'TENSION_ELEVEE' ? <Text style={[ui.muted, { color: colour.fg }]}>{b.elderlyNote}</Text> : null}
      {urgent ? (
        <View style={styles.checklist}>
          <Text style={[ui.text, { fontWeight: '700' }]}>{b.symptomsQuestion}</Text>
          {SYMPTOMS.map((s) => (
            <Checkbox
              key={s}
              label={b.symptoms[s]}
              checked={checked.includes(s)}
              onChange={(on) => setChecked((list) => (on ? [...list, s] : list.filter((x) => x !== s)))}
            />
          ))}
          {checked.length > 0 ? <Text style={[ui.text, { color: c.danger, fontWeight: '800' }]}>{b.symptomPresent}</Text> : null}
          <EmergencyButtons emphasis={checked.length > 0} />
        </View>
      ) : null}
      {!result.saved ? <Text style={[ui.muted, { color: colour.fg }]}>{b.saving}</Text> : null}
    </View>
  );
}

/** Minuteur facultatif de repos (1 ou 2 min) entre deux mesures. */
function RestTimer() {
  const { t, row } = useLanguage();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (endsAt === null) return undefined;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(id);
        setEndsAt(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 500);
    return () => clearInterval(id);
  }, [endsAt]);

  const start = (seconds: number) => {
    setRemaining(seconds);
    setEndsAt(Date.now() + seconds * 1000);
  };

  if (endsAt !== null) {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    return (
      <View style={styles.timer} accessibilityLiveRegion="polite">
        <Text style={styles.timerText}>{t.bp.rest(`${min}:${sec < 10 ? '0' + sec : sec}`)}</Text>
        <Button label={t.bp.stopTimer} variant="secondary" onPress={() => setEndsAt(null)} />
      </View>
    );
  }
  return (
    <View style={[styles.timerRow, row]}>
      <View style={{ flex: 1 }}>
        <Button label={t.bp.rest1} variant="secondary" onPress={() => start(60)} />
      </View>
      <View style={{ flex: 1 }}>
        <Button label={t.bp.rest2} variant="secondary" onPress={() => start(120)} />
      </View>
    </View>
  );
}

function ProtocolGrid({ series, selected, onSelect }: { series: BpSeries; selected: Slot | null; onSelect?: (s: Slot) => void }) {
  const { t, row } = useLanguage();
  const bySlot = new Map(series.mesures.map((m) => [slotKey(m), m]));
  return (
    <View style={styles.grid}>
      {([1, 2, 3] as const).map((jour) => (
        <View key={jour} style={{ gap: 6 }}>
          <Text style={[ui.text, { fontWeight: '700' }]}>{t.bp.gridDay(jour, protocolDay(series.dateDebut, jour - 1))}</Text>
          {(['MATIN', 'SOIR'] as const).map((moment) => (
            <View key={moment} style={[styles.gridRow, row]}>
              <Text style={[ui.muted, { width: 64 }]}>{t.bp.moment[moment]}</Text>
              {([1, 2, 3] as const).map((rang) => {
                const s: Slot = { jour, moment, rang };
                const m = bySlot.get(slotKey(s));
                const isSelected = !!selected && slotKey(selected) === slotKey(s);
                return (
                  <Pressable
                    key={rang}
                    accessibilityRole="button"
                    accessibilityLabel={t.bp.cellA11y(slotLabel(t, s), m?.tas ?? null, m?.tad ?? null)}
                    disabled={!onSelect}
                    onPress={() => onSelect?.(s)}
                    style={[
                      styles.cell,
                      m && { backgroundColor: LEVEL_COLOUR[m.niveau].bg, borderColor: LEVEL_COLOUR[m.niveau].fg },
                      isSelected && styles.cellSelected,
                    ]}
                  >
                    <Text style={[styles.cellLabel, m && { color: LEVEL_COLOUR[m.niveau].fg }]}>{t.bp.short(rang)}</Text>
                    <Text style={[styles.cellValue, m && { color: LEVEL_COLOUR[m.niveau].fg }]}>{m ? `${m.tas}/${m.tad}` : '—'}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function LevelBadge({ level }: { level: BpLevel }) {
  const { t } = useLanguage();
  const colour = level === 'URGENCE_HYPERTENSIVE' ? { bg: c.dangerSoft, fg: c.danger } : LEVEL_COLOUR[level];
  return <Badge label={t.bp.badge[level]} colours={colour} />;
}

const styles = StyleSheet.create({
  alert: { borderWidth: 2, borderRadius: radius.card, padding: 18, gap: 10 },
  alertTitle: { fontSize: 20, fontWeight: '800', flex: 1 },
  alertValue: { fontSize: 19, fontWeight: '700' },
  checklist: { backgroundColor: '#FFFFFF', borderRadius: radius.control, padding: 14, gap: 4 },
  average: { borderWidth: 2, borderRadius: radius.control, padding: 14, gap: 4, backgroundColor: c.card },
  inputs: { gap: 10 },
  input: { flex: 1 },
  timer: { gap: 6, alignItems: 'stretch' },
  timerText: { fontSize: 28, fontWeight: '800', color: c.primary, textAlign: 'center' },
  timerRow: { gap: 10 },
  grid: { gap: 12 },
  gridRow: { alignItems: 'center', gap: 6 },
  cell: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { borderWidth: 3, borderColor: c.primary },
  cellLabel: { fontSize: 13, color: c.muted, textAlign: 'center' },
  cellValue: { fontSize: 16, fontWeight: '700', color: c.title, textAlign: 'center' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
});
