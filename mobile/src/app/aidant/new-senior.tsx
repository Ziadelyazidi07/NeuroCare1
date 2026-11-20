/** Création du profil d'un senior (EF-AU-03). Pas de date de naissance : l'année suffit (§13.2). */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { aidantApi } from '../../api/api';
import type { Language } from '../../api/types';
import { errorMessage } from '../../lib/problem';
import { isE164, normalizePhone } from '../../lib/validation';
import { useLanguage } from '../../i18n';
import { Button, Card, colours as c, ErrorText, Field, Notice, radius, Screen, styles, Text } from '../../theme';

const LANGUES: Language[] = ['DARIJA', 'FR', 'AR'];

export default function NewSenior() {
  const { t, row } = useLanguage();
  const [nom, setNom] = useState('');
  const [langue, setLangue] = useState<Language>('DARIJA');
  const [surnom, setSurnom] = useState('');
  const [lien, setLien] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [contactTel, setContactTel] = useState('');
  const [annee, setAnnee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const tel = contactTel ? normalizePhone(contactTel) : undefined;
    if (tel && !isE164(tel)) {
      setError(t.newSenior.invalidPhone);
      return;
    }
    const year = annee ? Number(annee) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
      setError(t.newSenior.invalidYear);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const senior = await aidantApi.createSenior({
        nomComplet: nom.trim(),
        langue,
        surnomSenior: surnom.trim() || undefined,
        lienParente: lien.trim() || undefined,
        contactUrgenceNom: contactNom.trim() || undefined,
        contactUrgenceTel: tel,
        anneeNaissance: year,
      });
      // Étape suivante du parcours (cahier §2.1) : les consentements, avec le senior.
      router.replace(`/aidant/${senior.id}/consents`);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card title={t.newSenior.identity} icon="person">
        <Field label={t.newSenior.name} value={nom} onChangeText={setNom} placeholder="Hajj Ahmed" />
        <Field label={t.newSenior.nickname} value={surnom} onChangeText={setSurnom} placeholder="Baba" />
        <Field label={t.newSenior.link} value={lien} onChangeText={setLien} placeholder={t.newSenior.linkPlaceholder} />
        <Field label={t.newSenior.year} value={annee} onChangeText={setAnnee} keyboardType="number-pad" maxLength={4} />
        <Text style={styles.label}>{t.newSenior.reminderLanguage}</Text>
        <View style={[styles.row, row]}>
          {LANGUES.map((l) => (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ checked: langue === l }}
              onPress={() => setLangue(l)}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: radius.control,
                borderWidth: 1.5,
                borderColor: langue === l ? c.primary : c.inputBorder,
                backgroundColor: langue === l ? c.primary : c.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: langue === l ? c.primaryText : c.title, fontWeight: '700', fontSize: 17, textAlign: 'center' }}>{t.newSenior.languages[l]}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card title={t.newSenior.emergency} icon="call">
        <Field label={t.newSenior.contactName} value={contactNom} onChangeText={setContactNom} />
        <Field label={t.newSenior.contactPhone} value={contactTel} onChangeText={setContactTel} keyboardType="phone-pad" />
      </Card>
      <Notice>{t.newSenior.next}</Notice>
      <ErrorText message={error} />
      <Button label={t.newSenior.create} onPress={submit} loading={busy} disabled={!nom.trim()} />
    </Screen>
  );
}
