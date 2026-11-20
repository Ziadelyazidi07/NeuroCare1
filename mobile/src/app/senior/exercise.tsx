/**
 * Mini-jeu de rappel de mots (EF-CG-01 à 03) : facultatif, interruptible à tout moment sans pénalité.
 * Le résultat brut est envoyé tel quel ; aucun score ni interprétation n'est affiché (§13.3).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { seniorApi } from '../../api/api';
import type { ExerciseDto, WordDto } from '../../api/types';
import { useLanguage } from '../../i18n';
import { ApiError, errorMessage } from '../../lib/problem';
import { MIN_TOUCH, SENIOR_MIN_FONT, Text, radius, seniorColours, shadow } from '../../theme';

type Phase = 'chargement' | 'memoriser' | 'pause' | 'choisir' | 'fini' | 'erreur';
// Thème senior « normal » (contraste ≥ 7:1) aux couleurs médicales de l'application.
const colours = seniorColours.normal;

/** Horloge lue uniquement dans les gestionnaires d'événements (jamais pendant le rendu). */
function nowMs(): number {
  return Date.now();
}

function display(word: WordDto): string {
  return word.ecritureArabe ? `${word.ecritureArabe}\n${word.mot}` : word.mot;
}

export default function WordRecallGame() {
  const { t } = useLanguage();
  const [exercise, setExercise] = useState<ExerciseDto | null>(null);
  const [phase, setPhase] = useState<Phase>('chargement');
  const [remaining, setRemaining] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const startedAt = useRef(0);
  const pauseStartedAt = useRef(0);
  const recallStartedAt = useRef(0);
  const sent = useRef(false);

  useEffect(() => {
    seniorApi
      .nextExercise(3)
      .then((ex) => {
        startedAt.current = nowMs();
        setExercise(ex);
        setPhase('memoriser');
      })
      .catch((e) => {
        setError(e instanceof ApiError && e.isConsentRequired ? t.game.disabled : errorMessage(e, t));
        setPhase('erreur');
      });
    // Chargement unique à l'ouverture ; les textes d'erreur sont lus à ce moment-là.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecall = useCallback(() => {
    recallStartedAt.current = nowMs();
    setPhase('choisir');
  }, []);

  // Pause entre la mémorisation et le rappel (durée proposée par le serveur, écourtable).
  useEffect(() => {
    if (phase !== 'pause') return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          startRecall();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, startRecall]);

  const startPause = () => {
    pauseStartedAt.current = nowMs();
    setRemaining(exercise?.delaiRappelSec ?? 60);
    setPhase('pause');
  };

  const toggle = (mot: string) => {
    if (!exercise) return;
    if (chosen.includes(mot)) {
      setChosen(chosen.filter((m) => m !== mot));
      return;
    }
    if (chosen.length >= exercise.motsPresentes.length) return;
    setTimes([...times, nowMs() - recallStartedAt.current]);
    setChosen([...chosen, mot]);
  };

  const send = async (interrompu: boolean) => {
    if (!exercise || sent.current) {
      router.back();
      return;
    }
    sent.current = true;
    const delai = pauseStartedAt.current
      ? Math.round(((recallStartedAt.current || nowMs()) - pauseStartedAt.current) / 1000)
      : 0;
    try {
      const saved = await seniorApi.recordExercise({
        type: 'RAPPEL_MOTS',
        motsPresentes: exercise.motsPresentes.map((w) => w.mot),
        propositions: exercise.propositions.map((w) => w.mot),
        motsChoisis: chosen,
        delaiRappelSec: Math.min(600, delai),
        tempsReponseMs: times.slice(0, 9),
        dureeSec: Math.min(3600, Math.round((nowMs() - startedAt.current) / 1000)),
        interrompu,
      });
      if (interrompu) {
        router.back();
        return;
      }
      setResult(t.game.result(saved.corrects, saved.motsPresentes));
      setPhase('fini');
    } catch (e) {
      if (interrompu) {
        router.back();
        return;
      }
      setError(errorMessage(e, t));
      setPhase('erreur');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'chargement' ? <Text style={styles.text}>{t.game.loading}</Text> : null}

        {phase === 'memoriser' && exercise ? (
          <>
            <Text style={styles.title}>{t.game.remember}</Text>
            {exercise.motsPresentes.map((w) => (
              <Text key={w.mot} style={styles.word}>
                {display(w)}
              </Text>
            ))}
            <Big label={t.game.remembered} onPress={startPause} primary />
          </>
        ) : null}

        {phase === 'pause' ? (
          <>
            <Text style={styles.title}>{t.game.pause}</Text>
            <Text style={styles.text}>{t.game.pauseText}</Text>
            <Text style={styles.countdown}>{remaining}</Text>
            <Big label={t.game.continue} onPress={startRecall} primary />
          </>
        ) : null}

        {phase === 'choisir' && exercise ? (
          <>
            <Text style={styles.title}>{t.game.which}</Text>
            <View style={styles.grid}>
              {exercise.propositions.map((w) => {
                const selected = chosen.includes(w.mot);
                return (
                  <Pressable
                    key={w.mot}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggle(w.mot)}
                    style={[styles.choice, selected && styles.choiceSelected]}
                  >
                    <Text style={[styles.choiceText, selected && { color: colours.actionText }]}>{display(w)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Big label={t.game.submit} onPress={() => void send(false)} primary />
          </>
        ) : null}

        {phase === 'fini' ? (
          <>
            <Text style={styles.title}>{t.game.thanks}</Text>
            <Text style={styles.text}>{result}</Text>
            <Big label={t.common.back} onPress={() => router.back()} primary />
          </>
        ) : null}

        {phase === 'erreur' ? (
          <>
            <Text style={styles.text} accessibilityRole="alert">
              {error}
            </Text>
            <Big label={t.common.back} onPress={() => router.back()} primary />
          </>
        ) : null}

        {phase === 'memoriser' || phase === 'pause' || phase === 'choisir' ? (
          <Big label={t.game.stop} onPress={() => void send(true)} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Big({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.big, primary ? styles.bigPrimary : styles.bigSecondary, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.bigText, primary && { color: colours.actionText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background },
  content: { padding: 20, gap: 18 },
  title: { fontSize: 34, fontWeight: '800', color: colours.text, textAlign: 'center' },
  text: { fontSize: SENIOR_MIN_FONT + 4, color: colours.text, textAlign: 'center' },
  word: { fontSize: 44, fontWeight: '800', color: colours.action, textAlign: 'center', paddingVertical: 6 },
  countdown: { fontSize: 72, fontWeight: '900', color: colours.action, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  choice: {
    width: '30%',
    minHeight: MIN_TOUCH * 1.4,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: '#C9D6E8',
    backgroundColor: colours.card,
    ...shadow,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  choiceSelected: { backgroundColor: colours.action, borderColor: colours.action },
  choiceText: { fontSize: SENIOR_MIN_FONT, fontWeight: '700', color: colours.text, textAlign: 'center' },
  big: { minHeight: MIN_TOUCH * 1.25, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', padding: 12 },
  bigPrimary: { backgroundColor: colours.action },
  bigSecondary: { borderWidth: 2.5, borderColor: colours.muted, backgroundColor: colours.card },
  bigText: { fontSize: 28, fontWeight: '800', color: colours.text, textAlign: 'center' },
});
