/**
 * Module 4 — Métabolique : questionnaire FINDRISC (8 questions, IMC calculé), résultat immédiat même hors
 * ligne, historique et bilan PDF nominatif. Accès direct, sans compte : tout reste sur le téléphone.
 * Estimation de risque, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useLanguage } from '../../i18n';
import { Button, Card, ErrorText, Field, Loading, Row, Text, colours as c, radius, styles as ui } from '../../theme';
import { MeasurementGuideCard } from '../MeasurementGuideCard';
import { ModuleScreen } from '../ModuleScreen';
import { formatDateTime, sharePdf } from '../pdf';
import { OptionGroup, parseDecimal, useYesNo } from '../ui';
import {
  EMPTY_FORM,
  FAMILY_OPTIONS,
  MAX_SCORE,
  computeImc,
  decimal,
  levelSummary,
  parseForm,
  parseHeightCm,
  type FindriscForm,
  type FindriscLevel,
} from './findrisc';
import { findriscReportHtml, type FindriscReport } from './findriscPdf';
import { loadAssessments, saveAssessment, scoreAnswers, type FindriscAssessment } from './findriscStore';
import { metabolicModule } from './module';

const LEVEL_COLOUR: Record<FindriscLevel, string> = {
  FAIBLE: '#14653A',
  LEGEREMENT_ACCRU: '#5C6B00',
  MODERE: '#8A4600',
  ELEVE: '#C62828',
  TRES_ELEVE: '#8C1D18',
};

export default function MetabolicScreen() {
  return (
    <ModuleScreen module={metabolicModule} guide={<MeasurementGuideCard module={metabolicModule} device="metabolic" guide={(t) => t.findrisc.guide} />}>
      {(patient) => <FindriscPanel patient={patient} />}
    </ModuleScreen>
  );
}

function FindriscPanel({ patient }: { patient: string }) {
  const { t } = useLanguage();
  const f = t.findrisc;
  const yesNo = useYesNo();
  const [form, setForm] = useState<FindriscForm>(EMPTY_FORM);
  const [result, setResult] = useState<FindriscReport | null>(null);
  const [history, setHistory] = useState<FindriscAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistory(await loadAssessments());
  }, []);

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
      setError(f.errors[answers]);
      return;
    }
    // Résultat affiché immédiatement, puis mémorisé sur le téléphone.
    const assessment = scoreAnswers(answers);
    setResult(assessment);
    setError(null);
    try {
      await saveAssessment(assessment);
      setHistory((list) => [assessment, ...(list ?? [])]);
    } catch {
      setError(f.notSaved);
    }
  };

  const downloadPdf = async (report: FindriscReport) => {
    setError(null);
    try {
      const now = new Date();
      await sharePdf(t, findriscReportHtml(t, patient, report, now), { dialogTitle: f.pdf.dialog, module: 'metabolic', patient, generatedAt: now });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shared.pdfFailed);
    }
  };

  if (result) {
    const report = result;
    const colour = LEVEL_COLOUR[report.niveau];
    return (
      <>
        <View style={[styles.result, { borderColor: colour }]} accessibilityRole="alert">
          <Text style={[styles.resultTitle, { color: colour }]}>{levelSummary(t, report.niveau)}</Text>
          <Text style={styles.score}>{f.score(report.scoreTotal, MAX_SCORE)}</Text>
          <Text style={ui.text}>{f.imc(decimal(report.imc))}</Text>
          <Text style={ui.text}>{f.level[report.niveau].orientation}</Text>
          <ErrorText message={error} />
        </View>
        <Button label={f.download} icon="document-text" onPress={() => void downloadPdf(report)} />
        <Button
          label={f.newForm}
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
      <Card title={f.formTitle} icon="clipboard">
        <Field label={f.age} value={form.age} onChangeText={(v) => set('age', v)} keyboardType="number-pad" maxLength={3} placeholder="68" />
        <OptionGroup
          label={f.sex}
          options={[
            { value: 'HOMME', label: f.male },
            { value: 'FEMME', label: f.female },
          ]}
          value={form.sexe}
          onChange={(v) => set('sexe', v)}
        />
        <Field label={f.weight} value={form.poids} onChangeText={(v) => set('poids', v)} keyboardType="decimal-pad" maxLength={5} placeholder="72" />
        <Field label={f.height} value={form.taille} onChangeText={(v) => set('taille', v)} keyboardType="decimal-pad" maxLength={5} placeholder={f.heightPlaceholder} />
        <Text style={ui.muted}>{liveImc === null ? f.imcNone : f.imc(decimal(liveImc))}</Text>
        <Field
          label={f.waist}
          value={form.tourTaille}
          onChangeText={(v) => set('tourTaille', v)}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="92"
        />
        <OptionGroup
          label={f.activity}
          options={yesNo}
          value={form.activitePhysique}
          onChange={(v) => set('activitePhysique', v)}
        />
        <OptionGroup
          label={f.fruits}
          options={yesNo}
          value={form.fruitsLegumesQuotidiens}
          onChange={(v) => set('fruitsLegumesQuotidiens', v)}
        />
        <OptionGroup
          label={f.bpDrugs}
          options={yesNo}
          value={form.medicamentsHypertension}
          onChange={(v) => set('medicamentsHypertension', v)}
        />
        <OptionGroup
          label={f.glucose}
          options={yesNo}
          value={form.glycemieEleveeAntecedent}
          onChange={(v) => set('glycemieEleveeAntecedent', v)}
        />
        <OptionGroup
          label={f.family}
          options={FAMILY_OPTIONS.map((value) => ({ value, label: f.familyOptions[value] }))}
          value={form.antecedentsFamiliaux}
          onChange={(v) => set('antecedentsFamiliaux', v)}
        />
        <ErrorText message={error} />
        <Button label={f.submit} onPress={() => void submit()} />
      </Card>

      <Card title={f.previous} icon="time">
        {history === null ? <Loading /> : null}
        {history?.length === 0 ? <Text style={ui.muted}>{f.none}</Text> : null}
        {history?.map((h) => (
          <Row key={h.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(h.datePassation)}</Text>
              <Text style={[ui.muted, { color: LEVEL_COLOUR[h.niveau] }]}>
                {h.scoreTotal}/{MAX_SCORE} · {f.level[h.niveau].title}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={f.downloadThis} onPress={() => void downloadPdf(h)} hitSlop={8}>
              <Text style={styles.link}>{t.common.pdf}</Text>
            </Pressable>
          </Row>
        ))}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  link: { color: c.primary, fontWeight: '700', fontSize: 17 },
  result: { borderWidth: 2, borderRadius: radius.card, padding: 18, gap: 8, backgroundColor: c.card },
  resultTitle: { fontSize: 22, fontWeight: '800' },
  score: { fontSize: 24, fontWeight: '800', color: c.title },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
});
