/**
 * Assistant Santé & Orientation, ergonomie « Senior-First » sur un écran unique, sans aucun défilement :
 * - zone haute : grand bouton Retour, son activé / coupé, langue en 3 gros boutons (FR | العربية | الدارجة) ;
 * - zone centrale : une seule vue à la fois (consigne + 4 sujets, ou une seule carte de réponse, ou la saisie) ;
 * - zone basse ancrée : très grand micro « Parler » (pulsation pendant l'écoute) et bouton « Écrire ».
 * Chatbot 100 % hors ligne : aucune donnée de santé envoyée, seule la base de connaissances peut être mise
 * à jour depuis le microservice si le téléphone l'atteint.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dictionaryFor, useLanguage } from '../../i18n';
import { Text, colours as c, radius, shadow } from '../../theme';
import { goToModules } from '../../ui/HomeButton';
import type { ModuleId } from '../types';
import { EMERGENCY_NUMBERS } from '../ui';
import { loadKnowledge, syncKnowledge } from './assistantStore';
import { search, type SearchResult } from './engine';
import { EMBEDDED_KB, sourceOrgs, type KbLanguage, type KnowledgeBase } from './knowledge';
import { dictationAvailable, speak, startDictation, stopSpeaking, type SpokenLanguage } from './voice';

const ACCENT = '#246BFD';
const ACCENT_SOFT = '#EBF2FF';
/** Diamètre du bouton micro (≥ 76 dp). */
export const MIC_SIZE = 80;
/** Hauteur minimale des boutons de l'écran (≥ 56 dp). */
export const BUTTON_HEIGHT = 56;
/** Nombre de sujets proposés sur l'écran d'accueil de l'assistant. */
export const HOME_TOPICS = 4;
/** La police système agrandie reste lisible sans faire déborder l'écran unique. */
const MAX_SCALE = 1.25;

/** Écrans ouverts par le bouton d'action d'une réponse. */
export const MODULE_ROUTES: Record<ModuleId, Href> = {
  observance: '/observance-role',
  saturation: '/modules/saturation',
  mental: '/modules/mental',
  metabolic: '/modules/metabolic',
  cardio: '/modules/cardio',
  alzheimer: '/modules/alzheimer',
};

/** Les 3 langues, chacune écrite dans sa propre langue. */
const MODES: readonly { value: SpokenLanguage; label: string }[] = [
  { value: 'fr', label: 'FR' },
  { value: 'ar', label: 'العربية' },
  { value: 'darija', label: 'الدارجة' },
];

/** Texte lu à voix haute : titre et explication complète (la carte n'affiche que le résumé). */
export function spokenText(kb: KnowledgeBase, result: SearchResult): string {
  return result.kind === 'answer' ? `${result.topic.title[result.lang]}. ${result.topic.answer[result.lang]}` : kb.fallback[result.lang];
}

type CenterView = { kind: 'home' } | { kind: 'write' } | { kind: 'answer'; result: SearchResult };

export default function AssistantScreen({ loadApiBase }: { loadApiBase?: () => Promise<string> }) {
  const { t, language, setLanguage } = useLanguage();
  const a = t.assistant;
  const [kb, setKb] = useState<KnowledgeBase>(EMBEDDED_KB);
  const [mode, setMode] = useState<SpokenLanguage>(language === 'ar' ? 'darija' : 'fr');
  const [view, setView] = useState<CenterView>({ kind: 'home' });
  const [input, setInput] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState(false);
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const stopDictation = useRef<(() => void) | null>(null);
  const kbRef = useRef(kb);
  const answerLanguage: KbLanguage = mode === 'fr' ? 'fr' : 'ar';
  const rtl = t.meta.dir === 'rtl';

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const local = await loadKnowledge();
        if (cancelled) return;
        kbRef.current = local;
        setKb(local);
        if (!loadApiBase) return;
        const synced = await syncKnowledge(await loadApiBase(), local);
        if (cancelled) return;
        kbRef.current = synced.kb;
        setKb(synced.kb);
      })();
      return () => {
        cancelled = true;
      };
    }, [loadApiBase]),
  );

  // Rien ne doit continuer à parler ou écouter une fois l'écran quitté.
  useEffect(
    () => () => {
      stopSpeaking();
      stopDictation.current?.();
    },
    [],
  );

  const read = useCallback(
    (result: SearchResult) => {
      setNotice(null);
      const started = speak(spokenText(kbRef.current, result), result.lang, () => setSpeaking(false));
      setSpeaking(started);
      if (started) setHeard(true);
      else setNotice(a.noVoice);
    },
    [a.noVoice],
  );

  const silence = () => {
    stopSpeaking();
    setSpeaking(false);
  };

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const result = search(kbRef.current, text, answerLanguage);
    setView({ kind: 'answer', result });
    setInput('');
    setHeard(false);
    if (soundOn) read(result);
    else silence();
  };

  const backHome = () => {
    silence();
    setNotice(null);
    setView({ kind: 'home' });
  };

  const chooseMode = (next: SpokenLanguage) => {
    setMode(next);
    setLanguage(next === 'fr' ? 'fr' : 'ar');
  };

  const toggleSound = () => {
    if (soundOn) silence();
    setSoundOn(!soundOn);
  };

  const toggleMic = async () => {
    setNotice(null);
    if (listening) {
      stopDictation.current?.();
      return;
    }
    silence();
    let said = '';
    setPartial('');
    const stop = await startDictation(mode, {
      onText: (text, isFinal) => {
        said = text;
        setPartial(text);
        if (isFinal) stopDictation.current?.();
      },
      onEnd: () => {
        setListening(false);
        setPartial('');
        stopDictation.current = null;
        if (said.trim()) ask(said);
      },
      onError: (error) => {
        setListening(false);
        setNotice(error === 'unavailable' ? a.micUnavailable : error === 'denied' ? a.micDenied : a.micFailed);
      },
    });
    stopDictation.current = stop;
    setListening(stop !== null);
  };

  const writing = view.kind === 'write';

  return (
    <SafeAreaView style={styles.screen} testID="assistant-screen">
      {/* Zone haute compacte */}
      <View style={styles.top} testID="assistant-top">
        <View style={[styles.topRow, rtl && styles.rowRtl]}>
          <BigPill icon={rtl ? 'arrow-forward' : 'arrow-back'} label={a.back} onPress={goToModules} />
          <BigPill
            icon={soundOn ? 'volume-high' : 'volume-mute'}
            label={soundOn ? a.soundOn : a.soundOff}
            onPress={toggleSound}
            selected={soundOn}
            a11yRole="switch"
          />
        </View>
        {writing ? null : (
          <View style={[styles.modes, rtl && styles.rowRtl]} accessibilityRole="radiogroup" accessibilityLabel={a.languageA11y}>
            {MODES.map((m) => (
              <Pressable
                key={m.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === m.value }}
                onPress={() => chooseMode(m.value)}
                style={[styles.mode, mode === m.value && styles.modeOn]}
              >
                <Text maxFontSizeMultiplier={MAX_SCALE} style={[styles.modeText, mode === m.value && styles.onText]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Zone centrale : une seule vue à la fois */}
      <View style={styles.center} testID="assistant-center">
        {notice ? (
          <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={3} style={styles.notice} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        {listening ? (
          <View style={styles.listening}>
            <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.instruction}>
              {a.micListening}
            </Text>
            {partial ? (
              <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={3} style={styles.partial}>
                {a.heardYou(partial)}
              </Text>
            ) : null}
          </View>
        ) : view.kind === 'home' ? (
          <View style={styles.home}>
            <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={3} style={styles.instruction}>
              {a.instruction}
            </Text>
            {kb.suggestions[mode].slice(0, HOME_TOPICS).map((question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                onPress={() => ask(question)}
                style={({ pressed }) => [styles.topic, mode !== 'fr' && styles.rowRtl, pressed && styles.pressed]}
              >
                <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={2} style={[styles.topicText, mode !== 'fr' ? styles.rtl : styles.ltr]}>
                  {question}
                </Text>
                <Ionicons name={mode !== 'fr' ? 'chevron-back' : 'chevron-forward'} size={24} color={ACCENT} />
              </Pressable>
            ))}
          </View>
        ) : view.kind === 'write' ? (
          <View style={styles.home}>
            <TextInput
              style={[styles.input, answerLanguage === 'ar' ? styles.rtl : styles.ltr]}
              value={input}
              onChangeText={setInput}
              placeholder={a.placeholder}
              placeholderTextColor={c.muted}
              accessibilityLabel={a.inputLabel}
              onSubmitEditing={() => ask(input)}
              returnKeyType="send"
              maxFontSizeMultiplier={MAX_SCALE}
              autoFocus
            />
            <View style={styles.pair}>
              <Wide icon="send" label={a.send} onPress={() => ask(input)} disabled={!input.trim()} primary />
              <Wide icon="close" label={a.cancel} onPress={backHome} />
            </View>
          </View>
        ) : (
          <AnswerCard
            kb={kb}
            result={view.result}
            speaking={speaking}
            heard={heard}
            onListen={() => (speaking ? silence() : read(view.result))}
            onAnother={backHome}
          />
        )}
      </View>

      {/* Mini-bandeau éthique d'une seule ligne (texte complet pour les lecteurs d'écran) */}
      <View style={styles.ethics} accessible accessibilityLabel={a.disclaimer} testID="assistant-ethics">
        <Ionicons name="shield-checkmark" size={16} color={c.warning} />
        <Text maxFontSizeMultiplier={1} numberOfLines={1} style={styles.ethicsText}>
          {a.ethicsShort}
        </Text>
      </View>

      {/* Zone basse ancrée : micro central et « Écrire » (masquée pendant la saisie au clavier) */}
      {writing ? null : (
        <View style={[styles.bottom, rtl && styles.rowRtl]} testID="assistant-bottom">
          <View style={[styles.side, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                silence();
                setNotice(null);
                setView({ kind: 'write' });
              }}
              style={({ pressed }) => [styles.write, rtl && styles.rowRtl, pressed && styles.pressed]}
            >
              <Ionicons name="create" size={24} color={ACCENT} />
              <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.writeText}>
                {a.write}
              </Text>
            </Pressable>
          </View>
          <MicButton listening={listening} label={listening ? a.stopTalk : a.talk} a11y={a.micA11y} dimmed={!dictationAvailable()} onPress={() => void toggleMic()} />
          <View style={styles.side} />
        </View>
      )}
    </SafeAreaView>
  );
}

/** Très grand micro rond, avec un halo qui pulse pendant l'écoute. */
function MicButton({ listening, label, a11y, dimmed, onPress }: { listening: boolean; label: string; a11y: string; dimmed: boolean; onPress: () => void }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!listening) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);
  const halo = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
  };
  return (
    <View style={styles.micColumn}>
      <View style={styles.micBox}>
        {listening ? <Animated.View pointerEvents="none" style={[styles.halo, halo]} testID="mic-pulse" /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityState={{ busy: listening }}
          onPress={onPress}
          style={({ pressed }) => [styles.mic, listening && styles.micOn, dimmed && { opacity: 0.6 }, pressed && styles.pressed]}
          testID="assistant-mic"
        >
          <Ionicons name={listening ? 'stop' : 'mic'} size={40} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.micLabel}>
        {label}
      </Text>
    </View>
  );
}

function AnswerCard({
  kb,
  result,
  speaking,
  heard,
  onListen,
  onAnother,
}: {
  kb: KnowledgeBase;
  result: SearchResult;
  speaking: boolean;
  heard: boolean;
  onListen: () => void;
  onAnother: () => void;
}) {
  const { t } = useLanguage();
  const a = t.assistant;
  // Contenu (source, urgence, appels) dans la langue de la réponse ; boutons dans celle de l'écran.
  const content = dictionaryFor(result.lang).assistant;
  const dir = result.lang === 'ar' ? styles.rtl : styles.ltr;
  const topic = result.kind === 'answer' ? result.topic : null;
  const calls = topic?.actions.some((x) => x.type === 'call') ?? false;
  const module = topic?.actions.find((x) => x.type === 'module');
  // Un seul bouton d'action : les appels si c'est urgent (ou sans module associé), sinon le module concerné.
  const showCalls = !!topic && calls && (topic.urgent || !module);

  return (
    <View style={[styles.card, topic?.urgent && styles.cardUrgent]} accessibilityLiveRegion="polite" testID="assistant-card">
      {topic ? (
        <View style={[styles.titleRow, result.lang === 'ar' && styles.rowRtl]}>
          {topic.urgent ? <Ionicons name="warning" size={28} color={c.danger} /> : null}
          <Text
            maxFontSizeMultiplier={MAX_SCALE}
            numberOfLines={2}
            style={[styles.answerTitle, topic.urgent && styles.urgentTitle, dir]}
            accessibilityRole="header"
            accessibilityLabel={topic.urgent ? `${content.urgent} ${topic.title[result.lang]}` : undefined}
          >
            {topic.title[result.lang]}
          </Text>
        </View>
      ) : null}
      <Text
        maxFontSizeMultiplier={MAX_SCALE}
        numberOfLines={8}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[styles.summary, dir]}
        testID="assistant-summary"
      >
        {topic ? topic.summary[result.lang] : kb.fallback[result.lang]}
      </Text>

      {showCalls ? (
        <View style={[styles.pair, result.lang === 'ar' && styles.rowRtl]}>
          {EMERGENCY_NUMBERS.map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              onPress={() => void Linking.openURL(`tel:${n}`)}
              style={({ pressed }) => [styles.call, pressed && styles.pressed]}
            >
              <Ionicons name="call" size={24} color="#FFFFFF" />
              <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.callText}>
                {content.call(n)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : module?.type === 'module' ? (
        <View style={styles.pair}>
          <Wide icon="open-outline" label={a.openModule(t.home.modules[module.module].title)} onPress={() => router.push(MODULE_ROUTES[module.module])} />
        </View>
      ) : null}

      <View style={[styles.pair, t.meta.dir === 'rtl' && styles.rowRtl]}>
        <Wide icon={speaking ? 'stop' : 'volume-high'} label={speaking ? a.stopListening : heard ? a.relisten : a.listen} onPress={onListen} primary />
        <Wide label={a.another} onPress={onAnother} grow={1.3} />
      </View>

      {topic ? (
        <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={[styles.source, dir]}>
          {content.source(sourceOrgs(kb, topic, result.lang))}
        </Text>
      ) : null}
    </View>
  );
}

function BigPill({
  icon,
  label,
  onPress,
  selected = false,
  a11yRole = 'button',
}: {
  icon: 'arrow-back' | 'arrow-forward' | 'volume-high' | 'volume-mute';
  label: string;
  onPress: () => void;
  selected?: boolean;
  a11yRole?: 'button' | 'switch';
}) {
  return (
    <Pressable
      accessibilityRole={a11yRole}
      accessibilityState={a11yRole === 'switch' ? { checked: selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected && styles.pillOn, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={24} color={selected ? '#FFFFFF' : ACCENT} />
      <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={1} style={[styles.pillText, selected && styles.onText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Wide({
  icon,
  label,
  onPress,
  primary = false,
  disabled = false,
  grow = 1,
}: {
  icon?: 'send' | 'close' | 'stop' | 'volume-high' | 'open-outline';
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  /** Part de la largeur de la rangée (1 par défaut). */
  grow?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.wide, { flex: grow }, primary && styles.widePrimary, (pressed || disabled) && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={22} color={primary ? '#FFFFFF' : ACCENT} /> : null}
      <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={2} style={[styles.wideText, primary && styles.onText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  pressed: { opacity: 0.7 },
  onText: { color: '#FFFFFF' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  rowRtl: { flexDirection: 'row-reverse' },

  top: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  topRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  pillOn: { backgroundColor: ACCENT },
  pillText: { fontSize: 17, fontWeight: '800', color: ACCENT, flexShrink: 1 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: 2, borderColor: ACCENT, backgroundColor: c.card },
  modeOn: { backgroundColor: ACCENT },
  modeText: { fontSize: 18, fontWeight: '800', color: ACCENT, textAlign: 'center' },

  center: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', gap: 8 },
  notice: { fontSize: 16, fontWeight: '700', color: c.warning, textAlign: 'center' },
  home: { gap: 10 },
  instruction: { fontSize: 18, lineHeight: 25, fontWeight: '600', color: c.title, textAlign: 'center' },
  topic: {
    minHeight: BUTTON_HEIGHT + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: c.card,
    ...shadow,
  },
  topicText: { flex: 1, fontSize: 18, fontWeight: '700', color: c.title },
  listening: { gap: 12, alignItems: 'center' },
  partial: { fontSize: 20, fontWeight: '700', color: ACCENT, textAlign: 'center' },
  input: { minHeight: BUTTON_HEIGHT, borderRadius: radius.control, borderWidth: 2, borderColor: ACCENT, paddingHorizontal: 14, fontSize: 18, color: c.title, backgroundColor: c.card },

  card: { flexShrink: 1, gap: 10, padding: 14, borderRadius: radius.card + 4, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, ...shadow },
  cardUrgent: { borderColor: c.danger, borderWidth: 2, backgroundColor: c.dangerSoft },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: c.title },
  urgentTitle: { color: c.danger },
  summary: { fontSize: 18, lineHeight: 26, color: c.text, flexShrink: 1 },
  source: { fontSize: 13, fontStyle: 'italic', color: c.muted },
  pair: { flexDirection: 'row', gap: 8 },
  call: { flex: 1, minHeight: BUTTON_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.control, backgroundColor: c.danger },
  callText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  wide: {
    flex: 1,
    minHeight: BUTTON_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: ACCENT_SOFT,
  },
  widePrimary: { backgroundColor: ACCENT },
  wideText: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: ACCENT, textAlign: 'center' },

  ethics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4 },
  ethicsText: { flexShrink: 1, fontSize: 13, color: c.muted },

  bottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
  side: { flex: 1 },
  write: { minHeight: BUTTON_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 2, borderColor: ACCENT, backgroundColor: ACCENT_SOFT },
  writeText: { fontSize: 17, fontWeight: '800', color: ACCENT },
  micColumn: { alignItems: 'center', gap: 2 },
  micBox: { width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, backgroundColor: c.danger },
  mic: { width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', ...shadow },
  micOn: { backgroundColor: c.danger },
  micLabel: { fontSize: 18, fontWeight: '800', color: c.title },
});
