/** Création du profil d'un senior (EF-AU-03). Pas de date de naissance : l'année suffit (§13.2). */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { aidantApi } from '../../api/api';
import type { Language } from '../../api/types';
import { errorMessage } from '../../lib/problem';
import { isE164, normalizePhone } from '../../lib/validation';
import { Button, Card, ErrorText, Field, Notice, Screen, styles } from '../../ui/components';
import { aidantColours as c } from '../../ui/theme';

const LANGUES: { value: Language; label: string }[] = [
  { value: 'DARIJA', label: 'Darija' },
  { value: 'FR', label: 'Français' },
  { value: 'AR', label: 'Arabe' },
];

export default function NewSenior() {
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
      setError("Numéro du contact d'urgence invalide.");
      return;
    }
    const year = annee ? Number(annee) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) {
      setError('Année de naissance invalide.');
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
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card title="Identité">
        <Field label="Nom complet" value={nom} onChangeText={setNom} placeholder="Hajj Ahmed" />
        <Field label="Comment l'appelez-vous ? (utilisé dans les messages)" value={surnom} onChangeText={setSurnom} placeholder="Baba" />
        <Field label="Votre lien" value={lien} onChangeText={setLien} placeholder="fille, fils, voisin…" />
        <Field label="Année de naissance (facultatif)" value={annee} onChangeText={setAnnee} keyboardType="number-pad" maxLength={4} />
        <Text style={styles.label}>Langue des rappels</Text>
        <View style={styles.row}>
          {LANGUES.map((l) => (
            <Pressable
              key={l.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: langue === l.value }}
              onPress={() => setLangue(l.value)}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: c.primary,
                backgroundColor: langue === l.value ? c.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: langue === l.value ? c.primaryText : c.primary, fontWeight: '600' }}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card title="Contact d'urgence (bouton d'appel du senior)">
        <Field label="Nom" value={contactNom} onChangeText={setContactNom} />
        <Field label="Téléphone" value={contactTel} onChangeText={setContactTel} keyboardType="phone-pad" />
      </Card>
      <Notice>Ensuite : recueillir les consentements avec le senior, appairer son téléphone, puis saisir ses traitements.</Notice>
      <ErrorText message={error} />
      <Button label="Créer le profil" onPress={submit} loading={busy} disabled={!nom.trim()} />
    </Screen>
  );
}
