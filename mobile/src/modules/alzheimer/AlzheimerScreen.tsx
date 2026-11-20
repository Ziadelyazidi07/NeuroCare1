/**
 * Module 6 — Alzheimer & Mémoire : observation des 4 A (8 questions), exercice bienveillant des 4 mots,
 * indice de vigilance cognitive, conseils et bilan PDF nominatif. Accès direct, sans compte : tout reste sur
 * le téléphone. Pré-dépistage et aide à la consultation, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useLanguage } from '../../i18n';
import { Button, Card, ErrorText, Field, Loading, MIN_TOUCH, Row, Text, colours as c, radius, styles as ui } from '../../theme';
import { ModuleScreen } from '../ModuleScreen';
import { formatDateTime, sharePdf } from '../pdf';
import { OptionGroup } from '../ui';
import {
  CALCULATION,
  DOMAINS,
  QUESTIONS,
  RECOGNITION_CHOICES,
  WORDS,
  nextQuestion,
  personalisedTips,
  reasonText,
  recalledWords,
  scoreRecognition,
  weekdayOf,
  type Answers,
  type ExerciseResult,
  type ThingId,
  type Vigilance,
  type WordId,
} from './memory';
import { memoryReportHtml } from './memoryPdf';
import { buildAssessment, loadAssessments, saveAssessment, type MemoryAssessment } from './memoryStore';
import { alzheimerModule } from './module';

const COLOUR: Record<Vigilance, string> = { RASSURANT: c.success, SIGNES_A_SIGNALER: c.warning };

export default function AlzheimerScreen() {
  return <ModuleScreen module={alzheimerModule}>{(patient) => <MemoryPanel patient={patient} />}</ModuleScreen>;
}

type Phase = 'intro' | 'questions' | 'exercise' | 'result';

function MemoryPanel({ patient }: { patient: string }) {
  const { t, row } = useLanguage();
  const m = t.memory;
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<MemoryAssessment | null>(null);
  const [history, setHistory] = useState<MemoryAssessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistory(await loadAssessments());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const start = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    setPhase('questions');
  };

  const answer = (value: boolean) => {
    const q = nextQuestion(answers);
    if (!q) return;
    const updated = { ...answers, [q.code]: value };
    setAnswers(updated);
    if (nextQuestion(updated) === null) setPhase('exercise');
  };

  const previous = () => {
    const answered = QUESTIONS.filter((q) => answers[q.code] !== undefined);
    const last = answered[answered.length - 1];
    if (!last) return;
    const { [last.code]: _removed, ...rest } = answers;
    setAnswers(rest);
  };

  const finish = async (exercise: ExerciseResult | null) => {
    const assessment = buildAssessment(answers, exercise);
    if (!assessment) return;
    setResult(assessment);
    setPhase('result');
    setError(null);
    try {
      await saveAssessment(assessment);
      setHistory((list) => [assessment, ...(list ?? [])]);
    } catch {
      setError(m.notSaved);
    }
  };

  const downloadPdf = async (assessment: MemoryAssessment) => {
    setError(null);
    try {
      const list = history?.some((h) => h.id === assessment.id) ? history : [assessment, ...(history ?? [])];
      await sharePdf(t, memoryReportHtml(t, patient, assessment, list, new Date()), m.pdf.dialog);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.shared.pdfFailed);
    }
  };

  if (phase === 'questions') {
    const q = nextQuestion(answers);
    if (!q) return <Loading />;
    const index = QUESTIONS.indexOf(q);
    const domain = m.domains[q.domain];
    return (
      <Card title={m.sectionA(domain.title, domain.area)} icon="chatbubble-ellipses">
        <Text style={ui.muted}>
          {t.common.questionOf(index + 1, QUESTIONS.length)} · {m.instructions}
        </Text>
        <Text style={styles.question} accessibilityRole="header" accessibilityLiveRegion="polite">
          {m.lastWeeks(m.questions[q.code])}
        </Text>
        <View style={[styles.choices, row]}>
          <BigButton label={t.common.yes} onPress={() => answer(true)} />
          <BigButton label={t.common.no} onPress={() => answer(false)} />
        </View>
        {index > 0 ? <Button label={t.common.previousQuestion} variant="secondary" onPress={previous} /> : null}
        <Button label={t.common.giveUp} variant="secondary" onPress={() => setPhase('intro')} />
      </Card>
    );
  }

  if (phase === 'exercise') return <MemoryExercise onDone={(e) => void finish(e)} />;

  if (phase === 'result' && result) {
    return (
      <>
        <ResultCard assessment={result} />
        <ErrorText message={error} />
        <Button label={m.download} icon="document-text" onPress={() => void downloadPdf(result)} />
        <Button label={m.restart} variant="secondary" onPress={start} />
        <Button label={t.common.finish} variant="secondary" onPress={() => setPhase('intro')} />
      </>
    );
  }

  return (
    <>
      <Card title={m.introTitle} icon="bulb">
        <Text style={ui.text}>{m.intro}</Text>
        <Button label={t.common.start} onPress={start} />
      </Card>
      <Card title={m.previous} icon="time">
        {history === null && !error ? <Loading /> : null}
        <ErrorText message={error} />
        {history?.length === 0 ? <Text style={ui.muted}>{m.none}</Text> : null}
        {history?.map((h) => (
          <Row key={h.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(h.date)}</Text>
              <Text style={[ui.muted, { color: COLOUR[h.indice] }]}>
                {m.vigilance[h.indice].short} · {m.historyDetail(h.exercice ? h.exercice.rappelLibre.length : null)}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={m.downloadThis} onPress={() => void downloadPdf(h)} hitSlop={8}>
              <Text style={styles.link}>{t.common.pdf}</Text>
            </Pressable>
          </Row>
        ))}
      </Card>
    </>
  );
}

type Step = 'learn' | 'distraction' | 'recall' | 'recognition';

function MemoryExercise({ onDone }: { onDone: (result: ExerciseResult | null) => void }) {
  const { t, row } = useLanguage();
  const m = t.memory;
  const [step, setStep] = useState<Step>('learn');
  const [day, setDay] = useState<string | null>(null);
  const [calc, setCalc] = useState<string | null>(null);
  const [askedDay, setAskedDay] = useState(0);
  const [recallText, setRecallText] = useState('');
  const [recalled, setRecalled] = useState<WordId[]>([]);
  const [selected, setSelected] = useState<ThingId[]>([]);

  if (step === 'learn') {
    return (
      <Card title={m.learnTitle} icon="bulb">
        <Text style={ui.text}>{m.learn}</Text>
        <View style={[styles.wordGrid, row]}>
          {WORDS.map((w) => (
            <View key={w.id} style={styles.wordCard}>
              <Text style={styles.emoji}>{w.emoji}</Text>
              <Text style={styles.word}>{m.things[w.id]}</Text>
            </View>
          ))}
        </View>
        <Button
          label={m.learned}
          onPress={() => {
            setAskedDay(weekdayOf(new Date()));
            setStep('distraction');
          }}
        />
        <Button label={m.skip} variant="secondary" onPress={() => onDone(null)} />
      </Card>
    );
  }

  if (step === 'distraction') {
    return (
      <Card title={m.pauseTitle} icon="cafe">
        <Text style={ui.muted}>{m.pause}</Text>
        <OptionGroup label={m.dayQuestion} options={m.weekdays.map((d, i) => ({ value: String(i), label: d }))} value={day} onChange={setDay} />
        <OptionGroup
          label={m.calculation}
          options={CALCULATION.options.map((n) => ({ value: String(n), label: String(n) }))}
          value={calc}
          onChange={setCalc}
        />
        <Button label={m.continue} onPress={() => setStep('recall')} disabled={!day || !calc} />
      </Card>
    );
  }

  if (step === 'recall') {
    return (
      <Card title={m.recallTitle} icon="create">
        <Text style={ui.text}>{m.recall}</Text>
        <Field label={m.recallField} value={recallText} onChangeText={setRecallText} placeholder={m.recallPlaceholder} autoCorrect={false} />
        <Button
          label={recallText.trim() ? m.validate : m.forgot}
          onPress={() => {
            const words = recalledWords(recallText, m.forms);
            setRecalled(words);
            setSelected(words);
            setStep('recognition');
          }}
        />
      </Card>
    );
  }

  const toggle = (id: ThingId) => setSelected((list) => (list.includes(id) ? list.filter((w) => w !== id) : [...list, id]));
  return (
    <Card title={m.recognitionTitle} icon="images">
      <Text style={ui.text}>
        {m.recognition}
        {recalled.length ? m.alreadyFound(recalled.map((id) => m.things[id]).join(t.meta.listSeparator)) : ''}
      </Text>
      <View style={[styles.choiceGrid, row]}>
        {RECOGNITION_CHOICES.map((item) => {
          const on = selected.includes(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={m.things[item.id]}
              onPress={() => toggle(item.id)}
              style={[styles.choiceTile, on && styles.choiceTileOn]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[styles.choiceLabel, on && { color: c.primaryText }]}>{m.things[item.id]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button
        label={m.seeResult}
        onPress={() =>
          onDone({
            rappelLibre: recalled,
            ...scoreRecognition(selected, recalled),
            jourDemande: askedDay,
            jourRepondu: day === null ? -1 : Number(day),
            calculCorrect: calc === String(CALCULATION.answer),
          })
        }
      />
    </Card>
  );
}

function ResultCard({ assessment: a }: { assessment: MemoryAssessment }) {
  const { t } = useLanguage();
  const m = t.memory;
  const text = m.vigilance[a.indice];
  const colour = COLOUR[a.indice];
  return (
    <>
      <View style={[styles.result, { borderColor: colour }]} accessibilityRole="alert">
        <Text style={[styles.resultTitle, { color: colour }]}>{text.title}</Text>
        <Text style={ui.text}>{text.message}</Text>
        {a.raisons.map((r) => {
          const line = reasonText(t, r);
          return (
            <Text key={line} style={ui.text}>
              • {line}
            </Text>
          );
        })}
      </View>
      <Card title={m.domainsTitle} icon="grid">
        {DOMAINS.map((d) => (
          <Text key={d} style={ui.text}>
            {m.domainLine(m.domains[d].title, m.domains[d].area, a.signes[d])}
          </Text>
        ))}
        <Text style={ui.text}>{a.exercice ? m.recallLine(a.exercice.rappelLibre.length, a.exercice.reconnus.length) : m.noExercise}</Text>
      </Card>
      <Card title={m.tipsTitle} icon="leaf">
        {personalisedTips(t, a.reponses).map((tip) => (
          <Text key={tip} style={ui.text}>
            • {tip}
          </Text>
        ))}
      </Card>
      <Text style={ui.muted}>{m.screeningNotice}</Text>
    </>
  );
}

function BigButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.big, pressed && { opacity: 0.7 }]}>
      <Text style={styles.bigText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { color: c.primary, fontWeight: '700', fontSize: 17 },
  question: { fontSize: 22, lineHeight: 31, fontWeight: '700', color: c.title, marginVertical: 8 },
  choices: { gap: 12 },
  big: { flex: 1, minHeight: MIN_TOUCH * 1.25, borderRadius: radius.control, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  bigText: { color: c.primaryText, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  wordGrid: { flexWrap: 'wrap', gap: 10 },
  wordCard: { flexBasis: '46%', flexGrow: 1, alignItems: 'center', padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
  emoji: { fontSize: 40, textAlign: 'center' },
  word: { fontSize: 24, fontWeight: '800', color: c.title, textAlign: 'center' },
  choiceGrid: { flexWrap: 'wrap', gap: 8 },
  choiceTile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: MIN_TOUCH * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: c.inputBorder,
    backgroundColor: c.card,
  },
  choiceTileOn: { backgroundColor: c.primary, borderColor: c.primary },
  choiceLabel: { fontSize: 16, fontWeight: '600', color: c.title, textAlign: 'center' },
  result: { borderWidth: 2, borderRadius: radius.card, padding: 18, gap: 8, backgroundColor: c.card },
  resultTitle: { fontSize: 22, fontWeight: '800' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
});
