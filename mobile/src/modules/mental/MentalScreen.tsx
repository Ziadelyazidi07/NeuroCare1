/**
 * Module 3 — Santé mentale : Mini-GDS (4 questions), puis GDS-15 seulement si la Mini-GDS vaut au moins 1.
 * Restitution, orientation médicale et rapport PDF nominatif. Accès direct, sans compte : tout reste sur le
 * téléphone. Pré-dépistage, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useLanguage } from '../../i18n';
import { Button, Card, ErrorText, Loading, MIN_TOUCH, Row, Text, colours as c, radius, styles as ui } from '../../theme';
import { MeasurementGuideCard } from '../MeasurementGuideCard';
import { ModuleScreen } from '../ModuleScreen';
import { formatDateTime, sharePdf } from '../pdf';
import {
  MINI_GDS,
  answersToSend,
  nextQuestion,
  outcome,
  outcomeTitle,
  questionSequence,
  type GdsAnswers,
  type GdsLevel,
} from './gds';
import { gdsReportHtml, type GdsReport } from './gdsPdf';
import { addAssessment, loadAssessments, type GdsAssessment } from './gdsStore';
import { mentalModule } from './module';

const LEVEL_COLOUR: Record<GdsLevel, string> = { INDICE_NORMAL: c.success, LEGERE_A_MODEREE: c.warning, SEVERE: c.danger };

export default function MentalScreen() {
  return (
    <ModuleScreen module={mentalModule} guide={<MeasurementGuideCard module={mentalModule} guide={(t) => t.gds.guide} />}>
      {(patient) => <GdsPanel patient={patient} />}
    </ModuleScreen>
  );
}

type Phase = 'intro' | 'questions' | 'result';

function GdsPanel({ patient }: { patient: string }) {
  const { t, row } = useLanguage();
  const g = t.gds;
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<GdsAnswers>({});
  const [saved, setSaved] = useState<GdsAssessment | null>(null);
  const [history, setHistory] = useState<GdsAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistory(await loadAssessments());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const finish = async (complete: GdsAnswers) => {
    setPhase('result');
    setError(null);
    try {
      const assessment = await addAssessment(complete);
      setSaved(assessment);
      setHistory((list) => [assessment, ...(list ?? [])]);
    } catch {
      setError(g.notSaved);
    }
  };

  const answer = (value: boolean) => {
    const code = nextQuestion(answers);
    if (!code) return;
    const updated = { ...answers, [code]: value };
    setAnswers(updated);
    if (nextQuestion(updated) === null) void finish(updated);
  };

  const previous = () => {
    const sequence = questionSequence(answers);
    const answered = sequence.filter((code) => answers[code] !== undefined);
    const last = answered[answered.length - 1];
    if (!last) return;
    const { [last]: _removed, ...rest } = answers;
    setAnswers(rest);
  };

  const restart = () => {
    setAnswers({});
    setSaved(null);
    setError(null);
    setPhase('questions');
  };

  const downloadPdf = async (report: GdsReport) => {
    setError(null);
    try {
      const now = new Date();
      await sharePdf(t, gdsReportHtml(t, patient, report, now), { dialogTitle: g.pdf.dialog, module: 'mental', patient, generatedAt: now });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shared.pdfFailed);
    }
  };

  if (phase === 'questions') {
    const code = nextQuestion(answers);
    if (!code) return <Loading />;
    const sequence = questionSequence(answers);
    const index = sequence.indexOf(code);
    const step2 = index >= MINI_GDS.length;
    return (
      <Card title={step2 ? g.step2 : g.step1} icon="chatbubble-ellipses">
        <Text style={ui.muted}>
          {step2
            ? t.common.questionOf(index - MINI_GDS.length + 1, sequence.length - MINI_GDS.length)
            : t.common.questionOf(index + 1, MINI_GDS.length)}{' '}
          · {g.instructions}
        </Text>
        <Text style={styles.question} accessibilityRole="header" accessibilityLiveRegion="polite">
          {g.questions[code]}
        </Text>
        <View style={[styles.choices, row]}>
          <AnswerButton label={t.common.yes} onPress={() => answer(true)} />
          <AnswerButton label={t.common.no} onPress={() => answer(false)} />
        </View>
        {index > 0 ? <Button label={t.common.previousQuestion} variant="secondary" onPress={previous} /> : null}
        <Button label={t.common.giveUp} variant="secondary" onPress={() => setPhase('intro')} />
      </Card>
    );
  }

  if (phase === 'result') {
    const local = outcome(answers);
    const result = saved
      ? { miniGds: saved.scoreMiniGds, gds15: saved.scoreGds15 ?? null, level: saved.niveau }
      : local;
    if (!result) return <Loading />;
    const report: GdsReport = saved ?? {
      datePassation: new Date().toISOString(),
      reponses: answersToSend(answers),
      scoreMiniGds: result.miniGds,
      scoreGds15: result.gds15,
      niveau: result.level,
    };
    return (
      <>
        <View style={[styles.result, { borderColor: LEVEL_COLOUR[result.level] }]} accessibilityRole="alert">
          <Text style={[styles.resultTitle, { color: LEVEL_COLOUR[result.level] }]}>{outcomeTitle(t, result)}</Text>
          <Text style={ui.text}>{g.miniScore(result.miniGds)}</Text>
          {result.gds15 !== null ? <Text style={ui.text}>{g.gdsScore(result.gds15)}</Text> : null}
          <Text style={ui.text}>{g.level[result.level].orientation}</Text>
          <ErrorText message={error} />
        </View>
        <Button label={g.download} icon="document-text" onPress={() => void downloadPdf(report)} />
        <Button label={g.restart} variant="secondary" onPress={restart} />
        <Button label={t.common.finish} variant="secondary" onPress={() => setPhase('intro')} />
      </>
    );
  }

  return (
    <>
      <Card title={g.introTitle} icon="happy">
        <Text style={ui.text}>{g.intro}</Text>
        <Button label={t.common.start} onPress={restart} />
      </Card>
      <Card title={g.previous} icon="time">
        {history === null && !error ? <Loading /> : null}
        <ErrorText message={error} />
        {history?.length === 0 ? <Text style={ui.muted}>{g.none}</Text> : null}
        {history?.map((h) => (
          <Row key={h.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(h.datePassation)}</Text>
              <Text style={[ui.muted, { color: LEVEL_COLOUR[h.niveau] }]}>
                {g.historyScore(h.scoreMiniGds, h.scoreGds15 ?? null)} ·{' '}
                {outcomeTitle(t, { miniGds: h.scoreMiniGds, gds15: h.scoreGds15 ?? null, level: h.niveau })}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t.shared.downloadThisPdf} onPress={() => void downloadPdf(h)} hitSlop={8}>
              <Text style={styles.link}>{t.common.pdf}</Text>
            </Pressable>
          </Row>
        ))}
      </Card>
    </>
  );
}

function AnswerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.answer, pressed && { opacity: 0.7 }]}>
      <Text style={styles.answerText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: c.primary, fontWeight: '700', fontSize: 17 },
  question: { fontSize: 24, fontWeight: '700', color: c.title, marginVertical: 8 },
  choices: { gap: 12 },
  answer: { flex: 1, minHeight: MIN_TOUCH * 1.25, borderRadius: radius.control, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  answerText: { color: c.primaryText, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  result: { borderWidth: 2, borderRadius: radius.card, padding: 16, gap: 8, backgroundColor: c.card },
  resultTitle: { fontSize: 22, fontWeight: '800' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
});
