/**
 * Assistant Santé & Orientation : chatbot vocal 100 % hors ligne. Questions en français, arabe ou darija
 * (micro, clavier ou puces), réponses sourcées lues à voix haute, boutons d'action (15 / 141, modules
 * NeuroCare) et bandeau éthique permanent. Aucune donnée de santé n'est envoyée : seule la base de
 * connaissances peut être mise à jour depuis le microservice, si le téléphone l'atteint.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dictionaryFor, useLanguage } from '../../i18n';
import { MIN_TOUCH, ModuleHeader, Row, Text, colours as c, radius, shadow, styles as ui } from '../../theme';
import { HomeButton } from '../../ui/HomeButton';
import type { ModuleId } from '../types';
import { EmergencyButtons } from '../ui';
import { loadKnowledge, syncKnowledge, type SyncStatus } from './assistantStore';
import { search, type SearchResult } from './engine';
import { EMBEDDED_KB, sourceLine, type KbLanguage, type KnowledgeBase } from './knowledge';
import { dictationAvailable, speak, startDictation, stopSpeaking, type SpokenLanguage } from './voice';

const ACCENT = '#246BFD';
const ACCENT_SOFT = '#EBF2FF';

/** Écrans ouverts par les boutons d'action des réponses. */
export const MODULE_ROUTES: Record<ModuleId, Href> = {
  observance: '/observance-role',
  saturation: '/modules/saturation',
  mental: '/modules/mental',
  metabolic: '/modules/metabolic',
  cardio: '/modules/cardio',
  alzheimer: '/modules/alzheimer',
};

type Message = { id: number; role: 'user'; text: string } | { id: number; role: 'bot'; result: SearchResult };

/** Texte lu à voix haute pour une réponse. */
export function spokenText(kb: KnowledgeBase, result: SearchResult): string {
  return result.kind === 'answer' ? `${result.topic.title[result.lang]}. ${result.topic.answer[result.lang]}` : kb.fallback[result.lang];
}

export default function AssistantScreen({ loadApiBase }: { loadApiBase?: () => Promise<string> }) {
  const { t, language, row } = useLanguage();
  const a = t.assistant;
  const [kb, setKb] = useState<KnowledgeBase>(EMBEDDED_KB);
  const [status, setStatus] = useState<SyncStatus>('embarquee');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [autoRead, setAutoRead] = useState(true);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [heard, setHeard] = useState<ReadonlySet<number>>(new Set());
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState<SpokenLanguage>(language === 'ar' ? 'darija' : 'fr');
  const [notice, setNotice] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);
  const stopDictation = useRef<(() => void) | null>(null);
  const kbRef = useRef(kb);
  const uiLanguage: KbLanguage = language === 'ar' ? 'ar' : 'fr';

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
        setStatus(synced.status);
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
    (id: number, result: SearchResult) => {
      setNotice(null);
      const started = speak(spokenText(kbRef.current, result), result.lang, () => setSpeakingId((current) => (current === id ? null : current)));
      if (started) {
        setSpeakingId(id);
        setHeard((ids) => new Set(ids).add(id));
      } else setNotice(a.noVoice);
    },
    [a.noVoice],
  );

  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    const result = search(kbRef.current, text, uiLanguage);
    const userId = nextId.current++;
    const botId = nextId.current++;
    setMessages((list) => [...list, { id: userId, role: 'user', text }, { id: botId, role: 'bot', result }]);
    setInput('');
    if (autoRead) read(botId, result);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  };

  const toggleMic = async () => {
    setNotice(null);
    if (listening) {
      stopDictation.current?.();
      return;
    }
    stopSpeaking();
    setSpeakingId(null);
    let heard = '';
    const stop = await startDictation(spoken, {
      onText: (text, isFinal) => {
        heard = text;
        setInput(text);
        if (isFinal) stopDictation.current?.();
      },
      onEnd: () => {
        setListening(false);
        stopDictation.current = null;
        if (heard.trim()) ask(heard);
      },
      onError: (error) => {
        setListening(false);
        setNotice(error === 'unavailable' ? a.micUnavailable : error === 'denied' ? a.micDenied : a.micFailed);
      },
    });
    stopDictation.current = stop;
    setListening(stop !== null);
  };

  const suggestions = [...kb.suggestions[uiLanguage]];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <HomeButton />
        <ModuleHeader title={a.title} subtitle={a.subtitle} icon="chatbubble-ellipses" colour={ACCENT} tint={ACCENT_SOFT} />
        <Row style={styles.banner} accessibilityRole="text">
          <Ionicons name="shield-checkmark" size={22} color={c.warning} />
          <Text style={styles.bannerText}>{a.disclaimer}</Text>
        </Row>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled">
        <View style={[styles.bubble, styles.botBubble]}>
          <Text style={ui.text}>{a.welcome}</Text>
        </View>
        <Chips title={a.suggestions} items={suggestions} onPick={ask} />
        <Chips title={a.suggestionsDarija} items={kb.suggestions.darija} onPick={ask} rtl />

        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={[styles.bubble, styles.userBubble, { alignSelf: 'flex-end' }]} accessibilityLabel={`${a.you} : ${m.text}`}>
              <Text style={styles.userText}>{m.text}</Text>
            </View>
          ) : (
            <Answer
              key={m.id}
              kb={kb}
              result={m.result}
              speaking={speakingId === m.id}
              heard={heard.has(m.id)}
              onListen={() => (speakingId === m.id ? (stopSpeaking(), setSpeakingId(null)) : read(m.id, m.result))}
              onPick={ask}
            />
          ),
        )}
        <Text style={styles.status}>{a.knowledge(kb.version, a.status[status])}</Text>
      </ScrollView>

      <View style={styles.bottom}>
        {notice ? (
          <Text style={styles.notice} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        <Row style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={a.placeholder}
            placeholderTextColor={c.muted}
            accessibilityLabel={a.inputLabel}
            onSubmitEditing={() => ask(input)}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.send}
            onPress={() => ask(input)}
            disabled={!input.trim()}
            style={({ pressed }) => [styles.send, (!input.trim() || pressed) && { opacity: 0.5 }]}
          >
            <Ionicons name="send" size={24} color="#FFFFFF" />
          </Pressable>
        </Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={a.micA11y}
          accessibilityState={{ busy: listening }}
          onPress={() => void toggleMic()}
          style={({ pressed }) => [styles.mic, row, listening && styles.micListening, pressed && { opacity: 0.85 }, !dictationAvailable() && { opacity: 0.6 }]}
        >
          <Ionicons name={listening ? 'stop-circle' : 'mic'} size={32} color="#FFFFFF" />
          <Text style={styles.micText}>{listening ? a.micListening : a.mic}</Text>
        </Pressable>
        <Row style={styles.spokenRow}>
          <Text style={styles.spokenLabel}>{a.spokenLanguage}</Text>
          {(['fr', 'ar', 'darija'] as const).map((lang) => (
            <Pressable
              key={lang}
              accessibilityRole="radio"
              accessibilityState={{ selected: spoken === lang }}
              onPress={() => setSpoken(lang)}
              style={[styles.spoken, spoken === lang && styles.spokenOn]}
            >
              <Text style={[styles.spokenText, spoken === lang && { color: '#FFFFFF' }]}>{a.spoken[lang]}</Text>
            </Pressable>
          ))}
        </Row>
        <Row style={styles.autoRow}>
          <Text style={styles.spokenLabel}>{a.autoRead}</Text>
          <Switch value={autoRead} onValueChange={setAutoRead} accessibilityLabel={a.autoRead} trackColor={{ true: ACCENT, false: c.border }} />
        </Row>
      </View>
    </SafeAreaView>
  );
}

function Chips({ title, items, onPick, rtl = false }: { title: string; items: string[]; onPick: (q: string) => void; rtl?: boolean }) {
  const { row } = useLanguage();
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.chipsTitle}>{title}</Text>
      <View style={[styles.chips, row]}>
        {items.map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => onPick(item)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
            <Text style={[styles.chipText, rtl && styles.rtl]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Answer({
  kb,
  result,
  speaking,
  heard,
  onListen,
  onPick,
}: {
  kb: KnowledgeBase;
  result: SearchResult;
  speaking: boolean;
  heard: boolean;
  onListen: () => void;
  onPick: (q: string) => void;
}) {
  const { t, row } = useLanguage();
  const a = t.assistant;
  // Libellés liés au contenu (source, urgence) dans la langue de la réponse.
  const content = dictionaryFor(result.lang).assistant;
  const dir = result.lang === 'ar' ? styles.rtl : styles.ltr;
  const listenButton = (
    <Pressable
      accessibilityRole="button"
      onPress={onListen}
      style={({ pressed }) => [styles.listen, row, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={speaking ? 'stop' : 'volume-high'} size={24} color={ACCENT} />
      <Text style={styles.listenText}>{speaking ? a.stopListening : heard ? a.relisten : a.listen}</Text>
    </Pressable>
  );

  if (result.kind === 'fallback') {
    return (
      <View style={[styles.bubble, styles.botBubble]}>
        <Text style={[ui.text, dir]}>{kb.fallback[result.lang]}</Text>
        {listenButton}
        <Chips title={a.suggestions} items={result.suggestions} onPick={onPick} />
      </View>
    );
  }

  const { topic, lang, related } = result;
  const calls = topic.actions.some((action) => action.type === 'call');
  const modules = topic.actions.flatMap((action) => (action.type === 'module' ? [action.module] : []));
  return (
    <View style={[styles.bubble, styles.botBubble, topic.urgent && styles.urgentBubble]} accessibilityLiveRegion="polite">
      {topic.urgent ? (
        <Row style={{ gap: 8 }}>
          <Ionicons name="warning" size={24} color={c.danger} />
          <Text style={[styles.urgentText, dir]}>{content.urgent}</Text>
        </Row>
      ) : null}
      <Text style={[styles.answerTitle, dir]} accessibilityRole="header">
        {topic.title[lang]}
      </Text>
      <Text style={[styles.answer, dir]}>{topic.answer[lang]}</Text>
      <Text style={[styles.source, dir]}>{content.source(sourceLine(kb, topic, lang))}</Text>
      {listenButton}
      {calls ? <EmergencyButtons emphasis={topic.urgent} /> : null}
      {modules.map((id) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          onPress={() => router.push(MODULE_ROUTES[id])}
          style={({ pressed }) => [styles.moduleButton, row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="open-outline" size={22} color={ACCENT} />
          <Text style={styles.moduleText}>{a.openModule(t.home.modules[id].title)}</Text>
        </Pressable>
      ))}
      {related.length ? <Chips title={a.related} items={related.map((r) => r.title[lang])} onPick={onPick} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  top: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  banner: { gap: 10, alignItems: 'flex-start', backgroundColor: c.warningSoft, borderRadius: radius.card, padding: 12 },
  bannerText: { flex: 1, fontSize: 16, lineHeight: 22, color: c.title, fontWeight: '600' },
  chat: { padding: 16, gap: 12, paddingBottom: 24 },
  bubble: { borderRadius: radius.card, padding: 14, gap: 10, maxWidth: '100%' },
  botBubble: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, ...shadow },
  urgentBubble: { borderColor: c.danger, borderWidth: 2, backgroundColor: c.dangerSoft },
  userBubble: { backgroundColor: ACCENT, maxWidth: '85%' },
  userText: { color: '#FFFFFF', fontSize: 18, lineHeight: 25 },
  urgentText: { flex: 1, fontSize: 18, fontWeight: '800', color: c.danger },
  answerTitle: { fontSize: 21, fontWeight: '800', color: c.title },
  answer: { fontSize: 18, lineHeight: 27, color: c.text },
  source: { fontSize: 15, fontStyle: 'italic', color: c.muted },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  listen: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 2, borderColor: ACCENT, backgroundColor: ACCENT_SOFT },
  listenText: { fontSize: 18, fontWeight: '800', color: ACCENT },
  moduleButton: { minHeight: MIN_TOUCH, alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: radius.control, backgroundColor: ACCENT_SOFT },
  moduleText: { flex: 1, fontSize: 17, fontWeight: '700', color: c.title },
  chipsTitle: { fontSize: 16, fontWeight: '700', color: c.muted },
  chips: { flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: ACCENT, backgroundColor: c.card },
  chipText: { fontSize: 17, fontWeight: '600', color: ACCENT },
  status: { fontSize: 14, color: c.muted, textAlign: 'center' },
  bottom: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.card },
  notice: { fontSize: 16, color: c.warning, fontWeight: '600' },
  inputRow: { gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 52, borderRadius: radius.control, borderWidth: 1.5, borderColor: c.inputBorder, paddingHorizontal: 14, fontSize: 18, color: c.title, backgroundColor: c.background },
  send: { width: 52, height: 52, borderRadius: 26, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  mic: { minHeight: 68, borderRadius: radius.pill, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', gap: 12 },
  micListening: { backgroundColor: c.danger },
  micText: { fontSize: 21, fontWeight: '800', color: '#FFFFFF' },
  spokenRow: { gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  spokenLabel: { fontSize: 16, color: c.muted, flexShrink: 1 },
  spoken: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: ACCENT },
  spokenOn: { backgroundColor: ACCENT },
  spokenText: { fontSize: 16, fontWeight: '700', color: ACCENT },
  autoRow: { justifyContent: 'space-between', alignItems: 'center' },
});
