/** Appairage du téléphone du senior : code à 6 chiffres affiché sur le téléphone de l'aidant (EF-AU-04). */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../auth/SessionContext';
import { errorMessage } from '../../lib/problem';
import { isSixDigitCode } from '../../lib/validation';
import { HomeButton } from '../../ui/HomeButton';
import { MIN_TOUCH, SENIOR_MIN_FONT, seniorColours } from '../../ui/theme';

const colours = seniorColours.high;

export default function PairSenior() {
  const { pairSenior } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isSixDigitCode(code)) {
      setError('Le code contient 6 chiffres.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pairSenior(code);
      router.replace('/senior');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <HomeButton variant="senior" colours={colours} font={SENIOR_MIN_FONT} />
      <Text style={styles.title} accessibilityRole="header">
        Entrez le code
      </Text>
      <Text style={styles.text}>Votre proche voit ce code sur son téléphone.</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        accessibilityLabel="Code à 6 chiffres"
        placeholder="000000"
        placeholderTextColor="#666666"
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
        <Text style={styles.buttonText}>{busy ? 'Un instant…' : 'Valider'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>Retour</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.background, padding: 24, gap: 20, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '800', color: colours.text, textAlign: 'center' },
  text: { fontSize: SENIOR_MIN_FONT, color: colours.muted, textAlign: 'center' },
  input: {
    fontSize: 48,
    letterSpacing: 12,
    textAlign: 'center',
    color: colours.text,
    borderWidth: 3,
    borderColor: colours.action,
    borderRadius: 16,
    minHeight: MIN_TOUCH * 1.5,
  },
  error: { fontSize: SENIOR_MIN_FONT, color: colours.danger, textAlign: 'center' },
  button: { backgroundColor: colours.action, borderRadius: 20, minHeight: MIN_TOUCH * 1.5, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 32, fontWeight: '800', color: colours.actionText },
  back: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: SENIOR_MIN_FONT, color: colours.muted, textDecorationLine: 'underline' },
});
