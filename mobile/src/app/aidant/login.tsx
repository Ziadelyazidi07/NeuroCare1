/**
 * Espace aidant : connexion (téléphone + mot de passe, EF-AU-02) ou création de compte. Les identifiants
 * peuvent être mémorisés dans le stockage sécurisé du téléphone pour pré-remplir la prochaine connexion.
 */
import { useEffect, useState } from 'react';
import { router } from 'expo-router';

import { authApi } from '../../api/api';
import { useSession } from '../../auth/SessionContext';
import { clearSavedCredentials, loadSavedCredentials, saveCredentials } from '../../auth/savedCredentials';
import { ApiError, errorMessage } from '../../lib/problem';
import { isE164, normalizePhone, registrationError } from '../../lib/validation';
import { useLanguage } from '../../i18n';
import { Button, Card, Checkbox, ErrorText, Field, PasswordField, Screen } from '../../theme';
import { DemoFallback } from '../../ui/DemoAccess';

type Mode = 'connexion' | 'inscription';

export default function AidantLogin() {
  const { signInAidant } = useSession();
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('connexion');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    void loadSavedCredentials().then((saved) => {
      if (!saved) return;
      setPhone(saved.telephone);
      setPassword(saved.motDePasse);
      setRemember(true);
    });
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirmation('');
  };

  const submit = async () => {
    const telephone = normalizePhone(phone);
    const invalid =
      mode === 'inscription'
        ? registrationError({ nomComplet: name, telephone, motDePasse: password, confirmation })
        : isE164(telephone)
          ? null
          : 'TELEPHONE';
    if (invalid) {
      setError(t.registration[invalid]);
      return;
    }
    setBusy(true);
    setError(null);
    setUnreachable(false);
    try {
      if (mode === 'inscription') await authApi.register(name.trim(), telephone, password);
      await signInAidant(telephone, password);
      if (remember) await saveCredentials({ telephone, motDePasse: password });
      else await clearSavedCredentials();
      router.replace('/aidant');
    } catch (e) {
      setError(errorMessage(e, t));
      setUnreachable(e instanceof ApiError && e.isNetwork);
    } finally {
      setBusy(false);
    }
  };

  const registering = mode === 'inscription';
  const incomplete = !phone || !password || (registering && (!name.trim() || !confirmation));

  return (
    <Screen>
      <Card title={registering ? t.login.titleRegister : t.login.titleLogin} icon="person-circle">
        {registering ? (
          <Field label={t.login.name} value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" />
        ) : null}
        <Field
          label={t.login.phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
        />
        <PasswordField
          label={t.login.password}
          value={password}
          onChangeText={setPassword}
          autoComplete={registering ? 'new-password' : 'password'}
          onSubmitEditing={registering ? undefined : submit}
        />
        {registering ? (
          <PasswordField
            label={t.login.confirmation}
            value={confirmation}
            onChangeText={setConfirmation}
            autoComplete="new-password"
            onSubmitEditing={submit}
          />
        ) : null}
        <Checkbox label={t.login.remember} checked={remember} onChange={setRemember} />
        <ErrorText message={error} />
        <Button label={registering ? t.login.register : t.login.signIn} onPress={submit} loading={busy} disabled={incomplete} />
        <Button
          label={registering ? t.login.haveAccount : t.login.createAccount}
          variant="secondary"
          onPress={() => switchMode(registering ? 'connexion' : 'inscription')}
          disabled={busy}
        />
      </Card>
      <DemoFallback unreachable={unreachable} />
    </Screen>
  );
}
