/**
 * Traitements (EF-ME-01 à 03) : saisis à partir d'une prescription existante, puis modifiables ou
 * arrêtés. Aucun champ de dose calculée : la consigne est un texte libre recopié de l'ordonnance.
 * Une modification réaligne les prises côté serveur, qui prévient le téléphone du senior en temps réel.
 */
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import { JOURS, type JourSemaine, type MedicationDto } from '../../../api/types';
import { toIsoDate } from '../../../lib/dates';
import { ApiError, errorMessage } from '../../../lib/problem';
import { parseHHMM } from '../../../lib/validation';
import { Button, Card, ErrorText, Field, Loading, Notice, Screen, styles } from '../../../ui/components';
import { aidantColours as c } from '../../../ui/theme';

interface HoraireForm {
  heure: string;
  jours: JourSemaine[];
}

const NEW_HORAIRES: HoraireForm[] = [{ heure: '08:00', jours: [...JOURS] }];

export default function Medications() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const [list, setList] = useState<MedicationDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentMissing, setConsentMissing] = useState(false);

  const [editing, setEditing] = useState<MedicationDto | null>(null);
  const [nom, setNom] = useState('');
  const [consigne, setConsigne] = useState('');
  const [dateDebut, setDateDebut] = useState(toIsoDate(new Date()));
  const [dateFin, setDateFin] = useState('');
  const [horaires, setHoraires] = useState<HoraireForm[]>(NEW_HORAIRES);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await aidantApi.medications(seniorId));
      setError(null);
      setConsentMissing(false);
    } catch (e) {
      setConsentMissing(e instanceof ApiError && e.isConsentRequired);
      setError(errorMessage(e));
    }
  }, [seniorId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const resetForm = () => {
    setEditing(null);
    setNom('');
    setConsigne('');
    setDateDebut(toIsoDate(new Date()));
    setDateFin('');
    setHoraires(NEW_HORAIRES);
    setFormError(null);
  };

  const startEditing = (medication: MedicationDto) => {
    setEditing(medication);
    setNom(medication.nomMedicament);
    setConsigne(medication.consigne ?? '');
    setDateDebut(medication.dateDebut);
    setDateFin(medication.dateFin ?? '');
    setHoraires(medication.horaires.map((h) => ({ heure: h.heure.slice(0, 5), jours: [...h.jours] })));
    setFormError(null);
  };

  const updateHoraire = (index: number, patch: Partial<HoraireForm>) =>
    setHoraires((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const toggleJour = (index: number, jour: JourSemaine) => {
    const row = horaires[index];
    updateHoraire(index, { jours: row.jours.includes(jour) ? row.jours.filter((j) => j !== jour) : [...row.jours, jour] });
  };

  const submit = async () => {
    const parsed = horaires.map((h) => ({ heure: parseHHMM(h.heure), jours: JOURS.filter((j) => h.jours.includes(j)) }));
    if (parsed.some((h) => !h.heure)) {
      setFormError('Heure invalide : utilisez le format HH:MM (ex. 08:00).');
      return;
    }
    if (parsed.some((h) => h.jours.length === 0)) {
      setFormError('Choisissez au moins un jour pour chaque horaire.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const body = {
      nomMedicament: nom.trim(),
      consigne: consigne.trim() || undefined,
      dateDebut,
      dateFin: dateFin.trim() || undefined,
      horaires: parsed.map((h) => ({ heure: h.heure as string, jours: h.jours })),
    };
    try {
      if (editing) await aidantApi.updateMedication(editing.id, body);
      else await aidantApi.createMedication(seniorId, body);
      resetForm();
      await load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = (medication: MedicationDto) =>
    Alert.alert(`Arrêter « ${medication.nomMedicament} » ?`, "Les rappels à venir seront annulés. L'historique est conservé.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Arrêter',
        style: 'destructive',
        onPress: async () => {
          try {
            await aidantApi.deactivateMedication(medication.id);
            if (editing?.id === medication.id) resetForm();
            await load();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);

  if (consentMissing) {
    return (
      <Screen>
        <Notice>
          Les rappels nécessitent le consentement « Rappels » et le partage familial du senior. Recueillez-les avec lui dans
          « Consentements ».
        </Notice>
      </Screen>
    );
  }

  const form = (
    <Card title={editing ? `Modifier « ${editing.nomMedicament} »` : 'Ajouter un traitement'}>
      <Field label="Nom du médicament" value={nom} onChangeText={setNom} placeholder="Metformine 500" />
      <Field label="Consigne de l'ordonnance" value={consigne} onChangeText={setConsigne} placeholder="1 comprimé pendant le repas" />
      <Field label="Début (AAAA-MM-JJ)" value={dateDebut} onChangeText={setDateDebut} />
      <Field label="Fin (facultatif, AAAA-MM-JJ)" value={dateFin} onChangeText={setDateFin} />
      {horaires.map((h, index) => (
        <View key={index} style={{ gap: 6, padding: 10, borderRadius: 10, backgroundColor: c.background }}>
          <Field label={`Horaire ${index + 1} (HH:MM)`} value={h.heure} onChangeText={(heure) => updateHoraire(index, { heure })} keyboardType="numbers-and-punctuation" />
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {JOURS.map((jour) => {
              const on = h.jours.includes(jour);
              return (
                <Pressable
                  key={jour}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={jour}
                  onPress={() => toggleJour(index, jour)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    borderRadius: 22,
                    borderWidth: 1.5,
                    borderColor: c.primary,
                    backgroundColor: on ? c.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: on ? c.primaryText : c.primary, fontWeight: '600', fontSize: 12 }}>{jour}</Text>
                </Pressable>
              );
            })}
          </View>
          {horaires.length > 1 ? (
            <Button label="Retirer cet horaire" variant="secondary" onPress={() => setHoraires(horaires.filter((_, i) => i !== index))} />
          ) : null}
        </View>
      ))}
      {horaires.length < 12 ? (
        <Button label="Ajouter un horaire" variant="secondary" onPress={() => setHoraires([...horaires, { heure: '20:00', jours: [...JOURS] }])} />
      ) : null}
      <ErrorText message={formError} />
      <Button label={editing ? 'Enregistrer les modifications' : 'Enregistrer le traitement'} onPress={submit} loading={busy} disabled={!nom.trim()} />
      {editing ? <Button label="Annuler la modification" variant="secondary" onPress={resetForm} disabled={busy} /> : null}
    </Card>
  );

  return (
    <Screen>
      <ErrorText message={error} />
      {editing ? form : null}
      <Card title="Traitements en cours">
        {list === null && !error ? <Loading /> : null}
        {list?.length === 0 ? <Text style={styles.muted}>Aucun traitement.</Text> : null}
        {list?.map((m) => (
          <View key={m.id} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={[styles.text, { fontWeight: '700' }]}>{m.nomMedicament}</Text>
            {m.consigne ? <Text style={styles.muted}>{m.consigne}</Text> : null}
            <Text style={styles.muted}>
              {m.horaires.map((h) => `${h.heure.slice(0, 5)} (${h.jours.length === 7 ? 'tous les jours' : h.jours.join(', ')})`).join(' · ')}
            </Text>
            <Button label="Modifier ce traitement" variant="secondary" onPress={() => startEditing(m)} disabled={editing?.id === m.id} />
            <Button label="Arrêter ce traitement" variant="secondary" onPress={() => deactivate(m)} />
          </View>
        ))}
      </Card>
      {editing ? null : form}
      <Notice>NeuroCare ne propose ni ne calcule aucune dose : saisissez uniquement la consigne de la prescription existante.</Notice>
    </Screen>
  );
}
