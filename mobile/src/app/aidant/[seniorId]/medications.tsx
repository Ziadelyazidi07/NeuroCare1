/**
 * Traitements (EF-ME-01 à 03) : saisis à partir d'une prescription existante, puis modifiables ou
 * arrêtés. Aucun champ de dose calculée : la consigne est un texte libre recopié de l'ordonnance.
 * Une modification réaligne les prises côté serveur, qui prévient le téléphone du senior en temps réel.
 */
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import { JOURS, type JourSemaine, type MedicationDto } from '../../../api/types';
import { toIsoDate } from '../../../lib/dates';
import { ApiError, errorMessage } from '../../../lib/problem';
import { parseHHMM } from '../../../lib/validation';
import { useLanguage } from '../../../i18n';
import { Button, Card, colours as c, ErrorText, Field, Loading, Notice, radius, Screen, styles, Text } from '../../../theme';

interface HoraireForm {
  heure: string;
  jours: JourSemaine[];
}

const NEW_HORAIRES: HoraireForm[] = [{ heure: '08:00', jours: [...JOURS] }];

export default function Medications() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const { t, row } = useLanguage();
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
      setError(errorMessage(e, t));
    }
  }, [seniorId, t]);

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
      setFormError(t.medications.invalidTime);
      return;
    }
    if (parsed.some((h) => h.jours.length === 0)) {
      setFormError(t.medications.noDay);
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
      setFormError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = (medication: MedicationDto) =>
    Alert.alert(t.medications.stopTitle(medication.nomMedicament), t.medications.stopText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.medications.stop,
        style: 'destructive',
        onPress: async () => {
          try {
            await aidantApi.deactivateMedication(medication.id);
            if (editing?.id === medication.id) resetForm();
            await load();
          } catch (e) {
            setError(errorMessage(e, t));
          }
        },
      },
    ]);

  if (consentMissing) {
    return (
      <Screen>
        <Notice>{t.medications.consentRequired}</Notice>
      </Screen>
    );
  }

  const form = (
    <Card title={editing ? t.medications.editTitle(editing.nomMedicament) : t.medications.addTitle} icon="medkit">
      <Field label={t.medications.name} value={nom} onChangeText={setNom} placeholder="Metformine 500" />
      <Field label={t.medications.instruction} value={consigne} onChangeText={setConsigne} placeholder={t.medications.instructionPlaceholder} />
      <Field label={t.medications.start} value={dateDebut} onChangeText={setDateDebut} />
      <Field label={t.medications.end} value={dateFin} onChangeText={setDateFin} />
      {horaires.map((h, index) => (
        <View key={index} style={{ gap: 8, padding: 12, borderRadius: radius.control, backgroundColor: c.background }}>
          <Field label={t.medications.time(index + 1)} value={h.heure} onChangeText={(heure) => updateHoraire(index, { heure })} keyboardType="numbers-and-punctuation" />
          <View style={[styles.row, row, { flexWrap: 'wrap' }]}>
            {JOURS.map((jour) => {
              const on = h.jours.includes(jour);
              return (
                <Pressable
                  key={jour}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t.days[jour]}
                  onPress={() => toggleJour(index, jour)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    paddingHorizontal: 10,
                    borderRadius: 22,
                    borderWidth: 1.5,
                    borderColor: on ? c.primary : c.inputBorder,
                    backgroundColor: on ? c.primary : c.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: on ? c.primaryText : c.title, fontWeight: '700', fontSize: 15, textAlign: 'center' }}>{t.days[jour]}</Text>
                </Pressable>
              );
            })}
          </View>
          {horaires.length > 1 ? (
            <Button label={t.medications.removeTime} variant="secondary" onPress={() => setHoraires(horaires.filter((_, i) => i !== index))} />
          ) : null}
        </View>
      ))}
      {horaires.length < 12 ? (
        <Button label={t.medications.addTime} variant="secondary" onPress={() => setHoraires([...horaires, { heure: '20:00', jours: [...JOURS] }])} />
      ) : null}
      <ErrorText message={formError} />
      <Button label={editing ? t.medications.saveChanges : t.medications.save} onPress={submit} loading={busy} disabled={!nom.trim()} />
      {editing ? <Button label={t.medications.cancelEdit} variant="secondary" onPress={resetForm} disabled={busy} /> : null}
    </Card>
  );

  return (
    <Screen>
      <ErrorText message={error} />
      {editing ? form : null}
      <Card title={t.medications.current} icon="list">
        {list === null && !error ? <Loading /> : null}
        {list?.length === 0 ? <Text style={styles.muted}>{t.medications.none}</Text> : null}
        {list?.map((m) => (
          <View key={m.id} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={[styles.text, { fontWeight: '700' }]}>{m.nomMedicament}</Text>
            {m.consigne ? <Text style={styles.muted}>{m.consigne}</Text> : null}
            <Text style={styles.muted}>
              {m.horaires.map((h) => `${h.heure.slice(0, 5)} (${h.jours.length === 7 ? t.medications.everyDay : h.jours.map((j) => t.days[j]).join(t.meta.listSeparator)})`).join(' · ')}
            </Text>
            <Button label={t.medications.edit} variant="secondary" onPress={() => startEditing(m)} disabled={editing?.id === m.id} />
            <Button label={t.medications.deactivate} variant="secondary" onPress={() => deactivate(m)} />
          </View>
        ))}
      </Card>
      {editing ? null : form}
      <Notice>{t.medications.noDose}</Notice>
    </Screen>
  );
}
