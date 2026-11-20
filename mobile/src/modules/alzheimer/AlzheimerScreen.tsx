/**
 * Module 6 — Alzheimer & Mémoire : observation des 4 A (8 questions), exercice bienveillant des 4 mots,
 * indice de vigilance cognitive, conseils et bilan PDF nominatif. Accès direct, sans compte : tout reste sur
 * le téléphone. Pré-dépistage et aide à la consultation, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeButton } from '../../ui/HomeButton';
import { Button, Card, ErrorText, Field, Loading, Notice, styles as ui } from '../../ui/components';
import { MIN_TOUCH, aidantColours as c } from '../../ui/theme';
import { PatientNameField, displayName, usePatientName } from '../PatientName';
import { NOT_A_DIAGNOSIS, formatDateTime, sharePdf } from '../pdf';
import { OptionGroup } from '../ui';
import {
  CALCULATION,
  DOMAINS,
  DOMAIN_LABELS,
  QUESTIONNAIRE_INSTRUCTIONS,
  QUESTIONS,
  RECOGNITION_CHOICES,
  VIGILANCE_TEXT,
  WEEKDAYS,
  WORDS,
  nextQuestion,
  personalisedTips,
  recalledWords,
  scoreRecognition,
  weekdayOf,
  type Answers,
  type ExerciseResult,
  type Vigilance,
} from './memory';
import { SCREENING_NOTICE, memoryReportHtml } from './memoryPdf';
import { buildAssessment, loadAssessments, saveAssessment, type MemoryAssessment } from './memoryStore';
import { alzheimerModule } from './module';

const COLOUR: Record<Vigilance, string> = { RASSURANT: '#1E7B34', SIGNES_A_SIGNALER: '#8A4600' };

export default function AlzheimerScreen() {
  const [name, setName] = usePatientName();
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          {alzheimerModule.title}
        </Text>
        <PatientNameField value={name} onChange={setName} />
        <MemoryPanel patient={displayName(name)} />
        <Notice>{NOT_A_DIAGNOSIS}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

type Phase = 'intro' | 'questions' | 'exercise' | 'result';

function MemoryPanel({ patient }: { patient: string }) {
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
      setError('Bilan non mémorisé sur ce téléphone (le résultat reste affiché).');
    }
  };

  const downloadPdf = async (assessment: MemoryAssessment) => {
    setError(null);
    try {
      const list = history?.some((h) => h.id === assessment.id) ? history : [assessment, ...(history ?? [])];
      await sharePdf(memoryReportHtml(patient, assessment, list, new Date()), 'Bilan Mémoire NeuroCare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF impossible à créer.');
    }
  };

  if (phase === 'questions') {
    const q = nextQuestion(answers);
    if (!q) return <Loading />;
    const index = QUESTIONS.indexOf(q);
    return (
      <Card title={`Section A : les 4 A · ${DOMAIN_LABELS[q.domain].title} (${DOMAIN_LABELS[q.domain].area})`}>
        <Text style={ui.muted}>
          Question {index + 1} sur {QUESTIONS.length} · {QUESTIONNAIRE_INSTRUCTIONS}
        </Text>
        <Text style={styles.question} accessibilityRole="header" accessibilityLiveRegion="polite">
          Ces dernières semaines : {q.text}
        </Text>
        <View style={styles.choices}>
          <BigButton label="Oui" onPress={() => answer(true)} />
          <BigButton label="Non" onPress={() => answer(false)} />
        </View>
        {index > 0 ? <Button label="Question précédente" variant="secondary" onPress={previous} /> : null}
        <Button label="Abandonner" variant="secondary" onPress={() => setPhase('intro')} />
      </Card>
    );
  }

  if (phase === 'exercise') return <MemoryExercise onDone={(e) => void finish(e)} />;

  if (phase === 'result' && result) {
    return (
      <>
        <ResultCard assessment={result} />
        <ErrorText message={error} />
        <Button label="Télécharger le bilan Mémoire & 4 A PDF" onPress={() => void downloadPdf(result)} />
        <Button label="Refaire le bilan" variant="secondary" onPress={start} />
        <Button label="Terminer" variant="secondary" onPress={() => setPhase('intro')} />
      </>
    );
  }

  return (
    <>
      <Card title="Bilan Mémoire & 4 A">
        <Text style={ui.text}>
          Section A : 8 questions d’observation sur les dernières semaines (mémoire, langage, gestes, reconnaissance).
          Section B : un petit jeu de mémoire de 4 mots, sans chronomètre et sans piège. Comptez environ 5 minutes.
        </Text>
        <Button label="Commencer" onPress={start} />
      </Card>
      <Card title="Bilans précédents">
        {history === null && !error ? <Loading /> : null}
        <ErrorText message={error} />
        {history?.length === 0 ? <Text style={ui.muted}>Aucun bilan pour le moment.</Text> : null}
        {history?.map((h) => (
          <View key={h.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(h.date)}</Text>
              <Text style={[ui.muted, { color: COLOUR[h.indice] }]}>
                {h.indice === 'RASSURANT' ? 'Rassurant' : 'Signes à signaler'} ·{' '}
                {h.exercice ? `rappel ${h.exercice.rappelLibre.length}/4` : 'sans exercice'}
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

type Step = 'learn' | 'distraction' | 'recall' | 'recognition';

function MemoryExercise({ onDone }: { onDone: (result: ExerciseResult | null) => void }) {
  const [step, setStep] = useState<Step>('learn');
  const [day, setDay] = useState<string | null>(null);
  const [calc, setCalc] = useState<string | null>(null);
  const [askedDay, setAskedDay] = useState('');
  const [recallText, setRecallText] = useState('');
  const [recalled, setRecalled] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  if (step === 'learn') {
    return (
      <Card title="Section B : jeu de mémoire (1/4)">
        <Text style={ui.text}>Lisez ces 4 mots à voix haute et prenez le temps de bien les retenir. Je vous les redemanderai dans un instant.</Text>
        <View style={styles.wordGrid}>
          {WORDS.map((w) => (
            <View key={w.word} style={styles.wordCard}>
              <Text style={styles.emoji}>{w.emoji}</Text>
              <Text style={styles.word}>{w.word}</Text>
            </View>
          ))}
        </View>
        <Button
          label="J’ai retenu les 4 mots"
          onPress={() => {
            setAskedDay(weekdayOf(new Date()));
            setStep('distraction');
          }}
        />
        <Button label="Passer le jeu de mémoire" variant="secondary" onPress={() => onDone(null)} />
      </Card>
    );
  }

  if (step === 'distraction') {
    return (
      <Card title="Section B : petite pause (2/4)">
        <Text style={ui.muted}>Deux questions pour changer d’idée, sans pression.</Text>
        <OptionGroup label="Quel jour de la semaine sommes-nous ?" options={WEEKDAYS.map((d) => ({ value: d, label: d }))} value={day} onChange={setDay} />
        <OptionGroup
          label={CALCULATION.question}
          options={CALCULATION.options.map((n) => ({ value: String(n), label: String(n) }))}
          value={calc}
          onChange={setCalc}
        />
        <Button label="Continuer" onPress={() => setStep('recall')} disabled={!day || !calc} />
      </Card>
    );
  }

  if (step === 'recall') {
    return (
      <Card title="Section B : rappel des mots (3/4)">
        <Text style={ui.text}>Quels étaient les 4 mots ? Écrivez (ou faites écrire) ceux dont vous vous souvenez, dans n’importe quel ordre.</Text>
        <Field label="Mots retrouvés" value={recallText} onChangeText={setRecallText} placeholder="Ex. : mot1, mot2…" autoCorrect={false} />
        <Button
          label={recallText.trim() ? 'Valider mes mots' : 'Je ne m’en souviens pas'}
          onPress={() => {
            const words = recalledWords(recallText);
            setRecalled(words);
            setSelected(words);
            setStep('recognition');
          }}
        />
      </Card>
    );
  }

  const toggle = (word: string) => setSelected((list) => (list.includes(word) ? list.filter((w) => w !== word) : [...list, word]));
  return (
    <Card title="Section B : reconnaissance (4/4)">
      <Text style={ui.text}>
        Touchez les images des 4 mots appris tout à l’heure.
        {recalled.length ? ` Les mots déjà retrouvés (${recalled.join(', ')}) sont cochés.` : ''}
      </Text>
      <View style={styles.choiceGrid}>
        {RECOGNITION_CHOICES.map((item) => {
          const on = selected.includes(item.word);
          return (
            <Pressable
              key={item.word}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.word}
              onPress={() => toggle(item.word)}
              style={[styles.choiceTile, on && styles.choiceTileOn]}
            >
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={[styles.choiceLabel, on && { color: c.primaryText }]}>{item.word}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button
        label="Voir le résultat"
        onPress={() =>
          onDone({
            rappelLibre: recalled,
            ...scoreRecognition(selected, recalled),
            jourDemande: askedDay,
            jourRepondu: day ?? '',
            calculCorrect: calc === String(CALCULATION.answer),
          })
        }
      />
    </Card>
  );
}

function ResultCard({ assessment: a }: { assessment: MemoryAssessment }) {
  const text = VIGILANCE_TEXT[a.indice];
  const colour = COLOUR[a.indice];
  return (
    <>
      <View style={[styles.result, { borderColor: colour }]} accessibilityRole="alert">
        <Text style={[styles.resultTitle, { color: colour }]}>{text.title}</Text>
        <Text style={ui.text}>{text.message}</Text>
        {a.raisons.map((r) => (
          <Text key={r} style={ui.text}>
            • {r}
          </Text>
        ))}
      </View>
      <Card title="Résultats par domaine (4 A)">
        {DOMAINS.map((d) => (
          <Text key={d} style={ui.text}>
            {DOMAIN_LABELS[d].title} ({DOMAIN_LABELS[d].area}) : {a.signes[d]} signe{a.signes[d] > 1 ? 's' : ''} sur 2
          </Text>
        ))}
        <Text style={ui.text}>
          {a.exercice
            ? `Rappel des mots : ${a.exercice.rappelLibre.length} / 4 retrouvés, ${a.exercice.reconnus.length} reconnu(s) en images.`
            : 'Jeu de mémoire non réalisé.'}
        </Text>
      </Card>
      <Card title="Conseils pour prendre soin de sa mémoire">
        {personalisedTips(a.reponses).map((t) => (
          <Text key={t} style={ui.text}>
            • {t}
          </Text>
        ))}
      </Card>
      <Text style={ui.muted}>{SCREENING_NOTICE}</Text>
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
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  question: { fontSize: 22, fontWeight: '700', color: c.text, marginVertical: 8 },
  choices: { flexDirection: 'row', gap: 12 },
  big: { flex: 1, minHeight: MIN_TOUCH * 1.25, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  bigText: { color: c.primaryText, fontSize: 28, fontWeight: '800' },
  wordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wordCard: { flexBasis: '46%', flexGrow: 1, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card },
  emoji: { fontSize: 40 },
  word: { fontSize: 24, fontWeight: '800', color: c.text },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceTile: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: MIN_TOUCH * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.card,
  },
  choiceTileOn: { backgroundColor: c.primary },
  choiceLabel: { fontSize: 14, fontWeight: '600', color: c.primary },
  result: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 8, backgroundColor: c.card },
  resultTitle: { fontSize: 20, fontWeight: '800' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
});
