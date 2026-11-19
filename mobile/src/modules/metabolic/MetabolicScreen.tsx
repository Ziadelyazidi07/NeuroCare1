/**
 * Module 4 — Métabolique : questionnaire FINDRISC (8 questions, IMC calculé), résultat immédiat même hors
 * ligne, historique et bilan PDF nominatif. Estimation de risque, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '../../lib/problem';
import { HomeButton } from '../../ui/HomeButton';
import { Button, Card, ErrorText, Field, Loading, Notice, styles as ui } from '../../ui/components';
import { aidantColours as c } from '../../ui/theme';
import { PatientGate, type Patient } from '../PatientGate';
import { NOT_A_DIAGNOSIS, formatDateTime, sharePdf } from '../pdf';
import { OptionGroup, YES_NO, parseDecimal } from '../ui';
import {
  EMPTY_FORM,
  FAMILY_LABELS,
  LEVEL_TEXT,
  MAX_SCORE,
  computeImc,
  findriscPoints,
  levelOf,
  levelSummary,
  parseForm,
  parseHeightCm,
  totalOf,
  type FamilyHistory,
  type FindriscForm,
  type FindriscLevel,
} from './findrisc';
import { findriscApi, type FindriscAssessmentDto } from './findriscApi';
import { findriscReportHtml, type FindriscReport } from './findriscPdf';
import { metabolicModule } from './module';

const LEVEL_COLOUR: Record<FindriscLevel, string> = {
  FAIBLE: '#1E7B34',
  LEGEREMENT_ACCRU: '#5C6B00',
  MODERE: '#8A4600',
  ELEVE: '#B3261E',
  TRES_ELEVE: '#8C1D18',
};

export default function MetabolicScreen() {
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          {metabolicModule.title}
        </Text>
        <PatientGate>{(patient) => <FindriscPanel key={patient.seniorId} patient={patient} />}</PatientGate>
        <Notice>{NOT_A_DIAGNOSIS}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

function FindriscPanel({ patient }: { patient: Patient }) {
  const [form, setForm] = useState<FindriscForm>(EMPTY_FORM);
  const [result, setResult] = useState<{ report: FindriscReport; saved: boolean } | null>(null);
  const [history, setHistory] = useState<FindriscAssessmentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await findriscApi.history(patient.seniorId)).passations);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [patient.seniorId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const set = <K extends keyof FindriscForm>(key: K, value: FindriscForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const poids = parseDecimal(form.poids);
  const taille = parseHeightCm(form.taille);
  const liveImc = poids >= 20 && taille >= 100 && taille <= 250 ? computeImc(poids, taille) : null;

  const submit = async () => {
    const answers = parseForm(form);
    if (typeof answers === 'string') {
      setError(answers);
      return;
    }
    const points = findriscPoints(answers);
    const total = totalOf(points);
    // Résultat affiché immédiatement, même si l'enregistrement échoue (réseau).
    setResult({
      report: {
        ...answers,
        datePassation: new Date().toISOString(),
        imc: computeImc(answers.poidsKg, answers.tailleCm),
        points,
        scoreTotal: total,
        niveau: levelOf(total),
      },
      saved: false,
    });
    setBusy(true);
    setError(null);
    try {
      const saved = await findriscApi.record(patient.seniorId, answers);
      setResult({ report: saved, saved: true });
      await loadHistory();
    } catch (e) {
      setError(`Questionnaire non enregistré : ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (report: FindriscReport) => {
    setError(null);
    try {
      await sharePdf(findriscReportHtml(patient.nom, report, new Date()), 'Bilan FINDRISC NeuroCare');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (result) {
    const { report } = result;
    const colour = LEVEL_COLOUR[report.niveau];
    return (
      <>
        <View style={[styles.result, { borderColor: colour }]} accessibilityRole="alert">
          <Text style={[styles.resultTitle, { color: colour }]}>{levelSummary(report.niveau)}</Text>
          <Text style={styles.score}>
            Score FINDRISC : {report.scoreTotal} / {MAX_SCORE}
          </Text>
          <Text style={ui.text}>IMC calculé : {report.imc.toFixed(1).replace('.', ',')} kg/m²</Text>
          <Text style={ui.text}>{LEVEL_TEXT[report.niveau].orientation}</Text>
          {busy ? <Text style={ui.muted}>Enregistrement…</Text> : null}
          <ErrorText message={error} />
        </View>
        <Button label="Télécharger le bilan FINDRISC PDF" onPress={() => void downloadPdf(report)} />
        <Button
          label="Nouveau questionnaire"
          variant="secondary"
          onPress={() => {
            setResult(null);
            setForm(EMPTY_FORM);
            setError(null);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Card title="Questionnaire FINDRISC (8 questions)">
        <Field label="1. Âge (ans)" value={form.age} onChangeText={(v) => set('age', v)} keyboardType="number-pad" maxLength={3} placeholder="68" />
        <OptionGroup
          label="Sexe"
          options={[
            { value: 'HOMME', label: 'Homme' },
            { value: 'FEMME', label: 'Femme' },
          ]}
          value={form.sexe}
          onChange={(v) => set('sexe', v)}
        />
        <Field label="2. Poids (kg)" value={form.poids} onChangeText={(v) => set('poids', v)} keyboardType="decimal-pad" maxLength={5} placeholder="72" />
        <Field label="Taille (cm ou m)" value={form.taille} onChangeText={(v) => set('taille', v)} keyboardType="decimal-pad" maxLength={5} placeholder="168 ou 1,68" />
        <Text style={ui.muted}>
          IMC calculé : {liveImc === null ? '—' : `${liveImc.toFixed(1).replace('.', ',')} kg/m²`}
        </Text>
        <Field
          label="3. Tour de taille (cm, au niveau du nombril)"
          value={form.tourTaille}
          onChangeText={(v) => set('tourTaille', v)}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="92"
        />
        <OptionGroup
          label="4. Au moins 30 minutes d’activité physique par jour (travail ou loisirs) ?"
          options={YES_NO}
          value={form.activitePhysique}
          onChange={(v) => set('activitePhysique', v)}
        />
        <OptionGroup
          label="5. Mange des fruits ou des légumes tous les jours ?"
          options={YES_NO}
          value={form.fruitsLegumesQuotidiens}
          onChange={(v) => set('fruitsLegumesQuotidiens', v)}
        />
        <OptionGroup
          label="6. Prend régulièrement des médicaments contre l’hypertension artérielle ?"
          options={YES_NO}
          value={form.medicamentsHypertension}
          onChange={(v) => set('medicamentsHypertension', v)}
        />
        <OptionGroup
          label="7. Un taux de sucre élevé dans le sang a-t-il déjà été constaté (bilan, maladie, grossesse) ?"
          options={YES_NO}
          value={form.glycemieEleveeAntecedent}
          onChange={(v) => set('glycemieEleveeAntecedent', v)}
        />
        <OptionGroup<FamilyHistory>
          label="8. Des membres de la famille ont-ils un diabète (type 1 ou 2) ?"
          options={(Object.keys(FAMILY_LABELS) as FamilyHistory[]).map((value) => ({ value, label: FAMILY_LABELS[value] }))}
          value={form.antecedentsFamiliaux}
          onChange={(v) => set('antecedentsFamiliaux', v)}
        />
        <ErrorText message={error} />
        <Button label="Calculer le score" onPress={() => void submit()} loading={busy} />
      </Card>

      <Card title="Questionnaires précédents">
        {history === null ? <Loading /> : null}
        {history?.length === 0 ? <Text style={ui.muted}>Aucun questionnaire pour le moment.</Text> : null}
        {history?.map((h) => (
          <View key={h.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(h.datePassation)}</Text>
              <Text style={[ui.muted, { color: LEVEL_COLOUR[h.niveau] }]}>
                {h.scoreTotal}/{MAX_SCORE} · {LEVEL_TEXT[h.niveau].title}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Télécharger ce bilan en PDF" onPress={() => void downloadPdf(h)} hitSlop={8}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>PDF</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  result: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 8, backgroundColor: c.card },
  resultTitle: { fontSize: 20, fontWeight: '800' },
  score: { fontSize: 24, fontWeight: '800', color: c.text },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
});
