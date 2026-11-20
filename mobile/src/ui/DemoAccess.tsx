/**
 * Secours pour la démonstration du Module 1 : changer et tester l'adresse du serveur sur place (sans
 * recompiler), ou entrer en mode démo hors ligne (espace aidant ou senior, données locales fictives).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { getApiBase, setApiBase } from '../api/config';
import { useSession } from '../auth/SessionContext';
import { clearDemo } from '../demo/demoBackend';
import { useLanguage } from '../i18n';
import { cleanApiBase, healthUrl } from '../lib/urls';
import { Button, Card, ErrorText, Field, Text, colours as c, styles as ui } from '../theme';

const HEALTH_TIMEOUT_MS = 4000;

/** Vrai si le serveur répond à /actuator/health dans le délai imparti. */
export async function pingServer(apiBase: string, timeoutMs = HEALTH_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(healthUrl(apiBase), { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Champ d'adresse du serveur avec « Tester » (santé du backend) et « Enregistrer » (sans recompiler). */
export function ServerUrlEditor() {
  const { t } = useLanguage();
  const s = t.demo.server;
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getApiBase().then(setUrl);
  }, []);

  const test = async () => {
    setBusy(true);
    setMessage({ ok: true, text: s.testing });
    const ok = await pingServer(url);
    setMessage({ ok, text: ok ? s.ok(cleanApiBase(url)) : s.ko(healthUrl(url)) });
    setBusy(false);
  };

  return (
    <View style={styles.block}>
      <Field label={s.label} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <View style={styles.row}>
        <View style={styles.half}>
          <Button label={s.test} icon="pulse" variant="secondary" onPress={() => void test()} loading={busy} disabled={!url.trim()} />
        </View>
        <View style={styles.half}>
          <Button
            label={s.save}
            icon="save"
            variant="secondary"
            disabled={!url.trim() || busy}
            onPress={async () => {
              await setApiBase(url);
              setMessage({ ok: true, text: s.saved(cleanApiBase(url)) });
            }}
          />
        </View>
      </View>
      {message?.ok ? <Text style={ui.muted}>{message.text}</Text> : <ErrorText message={message?.text ?? null} />}
    </View>
  );
}

/** Entrée en mode démo hors ligne : espace aidant ou senior, puis navigation vers cet espace. */
export function DemoEntry() {
  const { t } = useLanguage();
  const { enterDemo } = useSession();
  const [done, setDone] = useState<string | null>(null);
  const enter = async (kind: 'aidant' | 'senior') => {
    await enterDemo(kind);
    router.replace(kind === 'aidant' ? '/aidant' : '/senior');
  };
  return (
    <View style={styles.block}>
      <Text style={ui.muted}>{t.demo.text}</Text>
      <Button label={t.demo.asAidant} icon="people" onPress={() => void enter('aidant')} />
      <Button label={t.demo.asSenior} icon="person" variant="secondary" onPress={() => void enter('senior')} />
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={async () => {
          await clearDemo();
          setDone(t.demo.resetDone);
        }}
      >
        <Text style={styles.link}>{t.demo.reset}</Text>
      </Pressable>
      {done ? <Text style={ui.muted}>{done}</Text> : null}
    </View>
  );
}

/**
 * Bloc de secours sous un formulaire de connexion : lien discret « Mode Démo Hors Ligne (Sans serveur) »
 * et adresse du serveur. Ouvert d'office quand le serveur est injoignable.
 */
export function DemoFallback({ unreachable = false }: { unreachable?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const visible = open || unreachable;
  return (
    <View style={styles.block}>
      {visible ? (
        <Card title={t.demo.title} icon="cloud-offline">
          {unreachable ? <Text style={[ui.text, { color: c.warning }]}>{t.demo.unreachable}</Text> : null}
          <DemoEntry />
          <Text style={styles.section}>{t.demo.server.title}</Text>
          <ServerUrlEditor />
        </Card>
      ) : (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen(true)} style={styles.discreet}>
          <Text style={styles.link}>{t.demo.button}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  discreet: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 16, color: c.muted, textDecorationLine: 'underline', textAlign: 'center' },
  section: { fontSize: 18, fontWeight: '700', color: c.title, marginTop: 8 },
});
