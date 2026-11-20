/**
 * Module 5 — Cardio-vasculaire : alerte immédiate à chaque mesure (même hors ligne), check-list de
 * symptômes en urgence, protocole d'automesure sur 3 jours (18 mesures) avec moyenne et relevé PDF.
 * Accès direct, sans compte : tout reste sur le téléphone. Pré-dépistage et orientation, jamais un diagnostic.
 */
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { toIsoDate } from '../../lib/dates';
import { HomeButton } from '../../ui/HomeButton';
import { Button, Card, Checkbox, ErrorText, Field, Loading, Notice, styles as ui } from '../../ui/components';
import { aidantColours as c } from '../../ui/theme';
import { PatientNameField, displayName, usePatientName } from '../PatientName';
import { NOT_A_DIAGNOSIS, formatDateTime, sharePdf } from '../pdf';
import { EmergencyButtons } from '../ui';
import {
  BP_ADVICE,
  ELDERLY_NOTE,
  PROTOCOL_INSTRUCTIONS,
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
} from './bp';
import { addMeasure, loadMeasures, loadSeries, recordSlot, startSeries, type BpMeasurement, type BpSeries } from './bpStore';
import { bpReportHtml } from './bpPdf';
import { cardioModule } from './module';

const LEVEL_COLOUR: Record<BpLevel, { bg: string; fg: string }> = {
  URGENCE_HYPERTENSIVE: { bg: '#B3261E', fg: '#FFFFFF' },
  HYPOTENSION: { bg: '#FEF3E0', fg: '#8A4600' },
  TENSION_ELEVEE: { bg: '#FEF3E0', fg: '#8A4600' },
  NORMALE: { bg: '#E6F4EA', fg: '#1E7B34' },
};

export default function CardioScreen() {
  const [name, setName] = usePatientName();
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          {cardioModule.title}
        </Text>
        <PatientNameField value={name} onChange={setName} />
        <CardioPanel patient={displayName(name)} />
        <Notice>{NOT_A_DIAGNOSIS}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

interface LastResult extends BpValues {
  level: BpLevel;
  saved: boolean;
  label: string;
}

function CardioPanel({ patient }: { patient: string }) {
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
    const label = target ? slotLabel(target.slot) : 'Mesure ponctuelle';
    // L'alerte s'affiche immédiatement, avant même la mémorisation sur le téléphone.
    setLast({ ...values, level: classifyBp(values.tas, values.tad), saved: false, label });
    setError(null);
    try {
      if (target) await recordSlot(target.serieId, target.slot, values);
      else await addMeasure(values);
      setLast({ ...values, level: classifyBp(values.tas, values.tad), saved: true, label });
      setSelected(null);
      await load();
      return true;
    } catch {
      setError('Mesure non mémorisée sur ce téléphone.');
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
      setError('Protocole non créé sur ce téléphone.');
    }
  };

  const downloadPdf = async (s: BpSeries) => {
    setError(null);
    try {
      await sharePdf(bpReportHtml(patient, s, new Date()), 'Relevé d’automesure HTA NeuroCare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF impossible à créer.');
    }
  };

  if (series === null) return <Loading />;

  const avg = current ? averageOf(current.mesures) : null;

  return (
    <>
      {last ? <AlertCard key={`${last.label}-${last.tas}-${last.tad}`} result={last} /> : null}
      <ErrorText message={error} />

      <Card title="Automesure sur 3 jours (18 mesures)">
        {PROTOCOL_INSTRUCTIONS.map((line) => (
          <Text key={line} style={ui.muted}>
            • {line}
          </Text>
        ))}
        {current ? <ProtocolGrid series={current} selected={slot} onSelect={active ? setSelected : undefined} /> : null}

        {avg && current ? (
          <View
            style={[styles.average, { borderColor: avg.elevated ? '#8A4600' : '#1E7B34' }]}
            accessibilityRole={currentComplete ? 'alert' : 'text'}
          >
            <Text style={[ui.text, { fontWeight: '700' }]}>
              Moyenne {currentComplete ? 'des 18 mesures' : `provisoire (${avg.count}/${PROTOCOL_SIZE})`} : {formatAverage(avg)}
            </Text>
            {currentComplete && avg.elevated ? (
              <Text style={[ui.text, { color: '#8A4600' }]}>
                Moyenne ≥ 135/85 mmHg : montrez ce relevé tensionnel à votre médecin.
              </Text>
            ) : null}
            {currentComplete && !avg.elevated ? (
              <Text style={[ui.text, { color: '#1E7B34' }]}>Moyenne inférieure à 135/85 mmHg.</Text>
            ) : null}
          </View>
        ) : null}

        {active && slot ? (
          <>
            <Text style={[ui.text, { fontWeight: '700' }]}>
              Saisie : {slotLabel(slot)} ({protocolDay(active.dateDebut, slot.jour - 1)})
            </Text>
            {slot.rang > 1 ? <RestTimer /> : null}
            <BpForm
              key={slotKey(slot)}
              submitLabel={`Enregistrer ${slotLabel(slot)}`}
              onSubmit={(values) => save(values, { serieId: active.id, slot })}
            />
          </>
        ) : (
          <Button
            label={current ? 'Démarrer un nouveau protocole (jour 1 = aujourd’hui)' : 'Démarrer le protocole (jour 1 = aujourd’hui)'}
            variant={current ? 'secondary' : 'primary'}
            onPress={() => void startProtocol()}
          />
        )}
        {current && current.mesures.length > 0 ? (
          <Button label="Télécharger le relevé d’automesure HTA PDF" variant="secondary" onPress={() => void downloadPdf(current)} />
        ) : null}
      </Card>

      <Card title="Mesure ponctuelle">
        <BpForm submitLabel="Enregistrer la mesure" onSubmit={(values) => save(values, null)} />
        {history && history.length > 0 ? <Text style={[ui.text, { fontWeight: '700' }]}>Dernières mesures</Text> : null}
        {history?.slice(0, 10).map((m) => (
          <View key={m.id} style={styles.historyRow}>
            <Text style={[ui.text, { flex: 1 }]}>
              {formatDateTime(m.dateMesure)} · {m.tas}/{m.tad} · {m.pouls} bpm
            </Text>
            <LevelBadge level={m.niveau} />
          </View>
        ))}
      </Card>
    </>
  );
}

function BpForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (v: BpValues) => Promise<boolean> }) {
  const [tas, setTas] = useState('');
  const [tad, setTad] = useState('');
  const [pouls, setPouls] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const parsed = parseBp(tas, tad, pouls);
    if (typeof parsed === 'string') {
      setError(parsed);
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
    <View style={{ gap: 8 }}>
      <View style={styles.inputs}>
        <View style={styles.input}>
          <Field label="TAS (grand chiffre)" value={tas} onChangeText={setTas} keyboardType="number-pad" maxLength={3} placeholder="128" />
        </View>
        <View style={styles.input}>
          <Field label="TAD (petit chiffre)" value={tad} onChangeText={setTad} keyboardType="number-pad" maxLength={3} placeholder="78" />
        </View>
      </View>
      <Field label="Pouls (bpm)" value={pouls} onChangeText={setPouls} keyboardType="number-pad" maxLength={3} placeholder="70" />
      <ErrorText message={error} />
      <Button label={submitLabel} onPress={() => void submit()} disabled={!tas || !tad || !pouls} />
    </View>
  );
}

function AlertCard({ result }: { result: LastResult }) {
  const [checked, setChecked] = useState<string[]>([]);
  const advice = BP_ADVICE[result.level];
  const colour = LEVEL_COLOUR[result.level];
  const urgent = result.level === 'URGENCE_HYPERTENSIVE';

  return (
    <View style={[styles.alert, { backgroundColor: colour.bg, borderColor: colour.fg }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={ui.row}>
        <Ionicons name={result.level === 'NORMALE' ? 'checkmark-circle' : 'warning'} size={28} color={colour.fg} />
        <Text style={[styles.alertTitle, { color: colour.fg }]}>{advice.title}</Text>
      </View>
      <Text style={[styles.alertValue, { color: colour.fg }]}>
        {result.label} : {result.tas}/{result.tad} mmHg · {result.pouls} bpm
      </Text>
      <Text style={{ color: colour.fg, fontSize: 16 }}>{advice.message}</Text>
      {result.level === 'NORMALE' || result.level === 'TENSION_ELEVEE' ? (
        <Text style={{ color: colour.fg, fontSize: 14 }}>{ELDERLY_NOTE}</Text>
      ) : null}
      {urgent ? (
        <View style={styles.checklist}>
          <Text style={[ui.text, { fontWeight: '700' }]}>Le patient ressent-il l’un de ces symptômes ?</Text>
          {SYMPTOMS.map((s) => (
            <Checkbox
              key={s}
              label={s}
              checked={checked.includes(s)}
              onChange={(on) => setChecked((list) => (on ? [...list, s] : list.filter((x) => x !== s)))}
            />
          ))}
          {checked.length > 0 ? (
            <Text style={[ui.text, { color: '#B3261E', fontWeight: '800' }]}>Symptôme présent : appelez immédiatement les urgences.</Text>
          ) : null}
          <EmergencyButtons emphasis={checked.length > 0} />
        </View>
      ) : null}
      {!result.saved ? <Text style={{ color: colour.fg, fontSize: 14 }}>Enregistrement en cours ou impossible.</Text> : null}
    </View>
  );
}

/** Minuteur facultatif de repos (1 ou 2 min) entre deux mesures. */
function RestTimer() {
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
        <Text style={styles.timerText}>
          Repos : {min}:{sec < 10 ? '0' + sec : sec}
        </Text>
        <Button label="Arrêter le minuteur" variant="secondary" onPress={() => setEndsAt(null)} />
      </View>
    );
  }
  return (
    <View style={styles.timerRow}>
      <View style={{ flex: 1 }}>
        <Button label="Repos 1 min" variant="secondary" onPress={() => start(60)} />
      </View>
      <View style={{ flex: 1 }}>
        <Button label="Repos 2 min" variant="secondary" onPress={() => start(120)} />
      </View>
    </View>
  );
}

function ProtocolGrid({ series, selected, onSelect }: { series: BpSeries; selected: Slot | null; onSelect?: (s: Slot) => void }) {
  const bySlot = new Map(series.mesures.map((m) => [slotKey(m), m]));
  return (
    <View style={styles.grid}>
      {([1, 2, 3] as const).map((jour) => (
        <View key={jour} style={{ gap: 4 }}>
          <Text style={[ui.text, { fontWeight: '700' }]}>
            Jour {jour} · {protocolDay(series.dateDebut, jour - 1)}
          </Text>
          {(['MATIN', 'SOIR'] as const).map((moment) => (
            <View key={moment} style={styles.gridRow}>
              <Text style={[ui.muted, { width: 52 }]}>{moment === 'MATIN' ? 'Matin' : 'Soir'}</Text>
              {([1, 2, 3] as const).map((rang) => {
                const s: Slot = { jour, moment, rang };
                const m = bySlot.get(slotKey(s));
                const isSelected = !!selected && slotKey(selected) === slotKey(s);
                return (
                  <Pressable
                    key={rang}
                    accessibilityRole="button"
                    accessibilityLabel={`${slotLabel(s)} : ${m ? `${m.tas} sur ${m.tad}` : 'à saisir'}`}
                    disabled={!onSelect}
                    onPress={() => onSelect?.(s)}
                    style={[
                      styles.cell,
                      m && { backgroundColor: LEVEL_COLOUR[m.niveau].bg, borderColor: LEVEL_COLOUR[m.niveau].fg },
                      isSelected && styles.cellSelected,
                    ]}
                  >
                    <Text style={styles.cellLabel}>M{rang}</Text>
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
  const label = { URGENCE_HYPERTENSIVE: 'Urgence', HYPOTENSION: 'Basse', TENSION_ELEVEE: 'Vigilance', NORMALE: 'Normale' }[level];
  const colour = LEVEL_COLOUR[level];
  return (
    <View style={[styles.badge, { backgroundColor: colour.bg, borderColor: colour.fg }]}>
      <Text style={{ color: colour.fg, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  alert: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 10 },
  alertTitle: { fontSize: 19, fontWeight: '800', flex: 1 },
  alertValue: { fontSize: 18, fontWeight: '700' },
  checklist: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, gap: 4 },
  average: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 4, backgroundColor: c.card },
  inputs: { flexDirection: 'row', gap: 8 },
  input: { flex: 1 },
  timer: { gap: 6, alignItems: 'stretch' },
  timerText: { fontSize: 28, fontWeight: '800', color: c.primary, textAlign: 'center' },
  timerRow: { flexDirection: 'row', gap: 8 },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cell: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: { borderWidth: 3, borderColor: c.primary },
  cellLabel: { fontSize: 11, color: c.muted },
  cellValue: { fontSize: 14, fontWeight: '700', color: c.text },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  badge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
});
