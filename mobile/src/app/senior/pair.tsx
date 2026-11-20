/** Appairage du téléphone du senior : code à 6 chiffres affiché sur le téléphone de l'aidant (EF-AU-04). */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../auth/SessionContext';
import { useLanguage } from '../../i18n';
import { errorMessage } from '../../lib/problem';
import { isSixDigitCode } from '../../lib/validation';
import { MIN_TOUCH, SENIOR_MIN_FONT, Text, radius, seniorColours, shadow } from '../../theme';
import { HomeButton } from '../../ui/HomeButton';

// Thème senior « normal » (contraste ≥ 7:1) aux couleurs médicales de l'application.
const colours = seniorColours.normal;

export default function PairSenior() {
  const { pairSenior } = useSession();
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isSixDigitCode(code)) {
      setError(t.pair.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pairSenior(code);
      router.replace('/senior');
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HomeButton variant="senior" colours={colours} font={SENIOR_MIN_FONT} />
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          {t.pair.title}
        </Text>
        <Text style={styles.text}>{t.pair.text}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          accessibilityLabel={t.pair.codeLabel}
          placeholder="000000"
          placeholderTextColor="#8A97AD"
          autoFocus
        />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, (pressed || busy) && { opacity: 0.7 }]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? t.pair.busy : t.pair.submit}</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>{t.common.back}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background, padding: 20, gap: 20, justifyContent: 'center' },
  card: { backgroundColor: colours.card, borderRadius: radius.card + 4, padding: 24, gap: 20, borderWidth: 1, borderColor: '#E6EEF8', ...shadow },
  title: { fontSize: 36, fontWeight: '800', color: colours.text, textAlign: 'center' },
  text: { fontSize: SENIOR_MIN_FONT, lineHeight: SENIOR_MIN_FONT * 1.35, color: colours.muted, textAlign: 'center' },
  input: {
    fontSize: 48,
    letterSpacing: 12,
    textAlign: 'center',
    color: colours.text,
    backgroundColor: '#F5F8FC',
    borderWidth: 3,
    borderColor: colours.action,
    borderRadius: radius.card,
    minHeight: MIN_TOUCH * 1.5,
  },
  error: { fontSize: SENIOR_MIN_FONT, color: colours.danger, textAlign: 'center' },
  button: { backgroundColor: colours.action, borderRadius: radius.card, minHeight: MIN_TOUCH * 1.5, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 32, fontWeight: '800', color: colours.actionText, textAlign: 'center' },
  back: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: SENIOR_MIN_FONT, color: colours.muted, textDecorationLine: 'underline', textAlign: 'center' },
});
