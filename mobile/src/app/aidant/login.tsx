/** Connexion de l'aidant : téléphone + mot de passe (EF-AU-02). */
import { useState } from 'react';
import { router } from 'expo-router';

import { useSession } from '../../auth/SessionContext';
import { errorMessage } from '../../lib/problem';
import { isE164, normalizePhone } from '../../lib/validation';
import { Button, Card, ErrorText, Field, Screen } from '../../ui/components';

export default function AidantLogin() {
  const { signInAidant } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const telephone = normalizePhone(phone);
    if (!isE164(telephone)) {
      setError('Numéro invalide. Exemple : 06 12 34 56 78 ou +212612345678.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInAidant(telephone, password);
      router.replace('/aidant');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card title="Espace aidant">
        <Field
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          onSubmitEditing={submit}
        />
        <ErrorText message={error} />
        <Button label="Se connecter" onPress={submit} loading={busy} disabled={!phone || !password} />
      </Card>
    </Screen>
  );
}
