/**
 * Module 3 — Santé mentale : Mini-GDS (4 questions), puis GDS-15 seulement si la Mini-GDS vaut au moins 1.
 * Restitution, orientation médicale et rapport PDF nominatif. Accès direct, sans compte : tout reste sur le
 * téléphone. Pré-dépistage, jamais un diagnostic.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeButton } from '../../ui/HomeButton';
import { Button, Card, ErrorText, Loading, Notice, styles as ui } from '../../ui/components';
import { MIN_TOUCH, aidantColours as c } from '../../ui/theme';
import { PatientNameField, displayName, usePatientName } from '../PatientName';
import { NOT_A_DIAGNOSIS, formatDateTime, sharePdf } from '../pdf';
import {
  INSTRUCTIONS,
  LEVEL_TEXT,
  MINI_GDS,
  QUESTIONS,
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

const LEVEL_COLOUR: Record<GdsLevel, string> = { INDICE_NORMAL: '#1E7B34', LEGERE_A_MODEREE: '#8A4600', SEVERE: '#B3261E' };

export default function MentalScreen() {
  const [name, setName] = usePatientName();
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={ui.content}>
        <HomeButton />
        <Text style={styles.title} accessibilityRole="header">
          {mentalModule.title}
        </Text>
        <PatientNameField value={name} onChange={setName} />
        <GdsPanel patient={displayName(name)} />
        <Notice>{NOT_A_DIAGNOSIS}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

type Phase = 'intro' | 'questions' | 'result';

function GdsPanel({ patient }: { patient: string }) {
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
      setError('Questionnaire non mémorisé sur ce téléphone (le résultat reste affiché).');
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
      await sharePdf(gdsReportHtml(patient, report, new Date()), 'Rapport GDS NeuroCare');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF impossible à créer.');
    }
  };

  if (phase === 'questions') {
    const code = nextQuestion(answers);
    if (!code) return <Loading />;
    const sequence = questionSequence(answers);
    const index = sequence.indexOf(code);
    const step2 = index >= MINI_GDS.length;
    return (
      <Card title={step2 ? 'Étape 2 : questions complémentaires (GDS-15)' : 'Étape 1 : Mini-GDS'}>
        <Text style={ui.muted}>
          {step2
            ? `Question ${index - MINI_GDS.length + 1} sur ${sequence.length - MINI_GDS.length}`
            : `Question ${index + 1} sur ${MINI_GDS.length}`}{' '}
          · {INSTRUCTIONS}
        </Text>
        <Text style={styles.question} accessibilityRole="header" accessibilityLiveRegion="polite">
          {QUESTIONS[code].text}
        </Text>
        <View style={styles.choices}>
          <AnswerButton label="Oui" onPress={() => answer(true)} />
          <AnswerButton label="Non" onPress={() => answer(false)} />
        </View>
        {index > 0 ? <Button label="Question précédente" variant="secondary" onPress={previous} /> : null}
        <Button label="Abandonner" variant="secondary" onPress={() => setPhase('intro')} />
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
          <Text style={[styles.resultTitle, { color: LEVEL_COLOUR[result.level] }]}>{outcomeTitle(result)}</Text>
          <Text style={ui.text}>Score Mini-GDS : {result.miniGds} / 4</Text>
          {result.gds15 !== null ? <Text style={ui.text}>Score GDS-15 : {result.gds15} / 15</Text> : null}
          <Text style={ui.text}>{LEVEL_TEXT[result.level].orientation}</Text>
          <ErrorText message={error} />
        </View>
        <Button label="Télécharger le rapport GDS PDF" onPress={() => void downloadPdf(report)} />
        <Button label="Refaire le questionnaire" variant="secondary" onPress={restart} />
        <Button label="Terminer" variant="secondary" onPress={() => setPhase('intro')} />
      </>
    );
  }

  return (
    <>
      <Card title="Questionnaire sur l’humeur">
        <Text style={ui.text}>
          Quelques questions sur l’état émotionnel des 7 derniers jours. Étape 1 : 4 questions (Mini-GDS). Si une réponse
          le justifie, l’étape 2 complète avec les questions de la GDS-15.
        </Text>
        <Button label="Commencer" onPress={restart} />
      </Card>
      <Card title="Passations précédentes">
        {history === null && !error ? <Loading /> : null}
        <ErrorText message={error} />
        {history?.length === 0 ? <Text style={ui.muted}>Aucune passation pour le moment.</Text> : null}
        {history?.map((h) => (
          <View key={h.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{formatDateTime(h.datePassation)}</Text>
              <Text style={[ui.muted, { color: LEVEL_COLOUR[h.niveau] }]}>
                {h.scoreGds15 == null ? `Mini-GDS ${h.scoreMiniGds}/4` : `GDS-15 ${h.scoreGds15}/15`} ·{' '}
                {outcomeTitle({ miniGds: h.scoreMiniGds, gds15: h.scoreGds15 ?? null, level: h.niveau })}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Télécharger ce rapport en PDF" onPress={() => void downloadPdf(h)} hitSlop={8}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>PDF</Text>
            </Pressable>
          </View>
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
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  question: { fontSize: 24, fontWeight: '700', color: c.text, marginVertical: 8 },
  choices: { flexDirection: 'row', gap: 12 },
  answer: { flex: 1, minHeight: MIN_TOUCH * 1.25, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  answerText: { color: c.primaryText, fontSize: 28, fontWeight: '800' },
  result: { borderWidth: 2, borderRadius: 14, padding: 16, gap: 8, backgroundColor: c.card },
  resultTitle: { fontSize: 20, fontWeight: '800' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border },
});
