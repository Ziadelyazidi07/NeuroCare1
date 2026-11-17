/**
 * Les 4 consentements, accordés ou retirés indépendamment (EF-CO-02). L'aidant enregistre le choix du
 * senior en sa présence : une confirmation explicite est demandée à chaque changement (cahier §7.2).
 */
import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import type { ConsentDto, ConsentHistoryDto, ConsentType } from '../../../api/types';
import { formatDay, formatTime } from '../../../lib/dates';
import { errorMessage } from '../../../lib/problem';
import { Card, ErrorText, Loading, Notice, Screen, styles } from '../../../ui/components';
import { aidantColours as c } from '../../../ui/theme';

const DESCRIPTIONS: Record<ConsentType, { titre: string; texte: string }> = {
  RAPPELS: { titre: 'Rappels de traitement', texte: 'Recevoir des rappels à l’heure de ses médicaments.' },
  EXERCICES: { titre: 'Exercices de mémoire', texte: 'Faire, s’il le souhaite, de petits jeux de mots. Ce n’est pas un diagnostic.' },
  PARTAGE_FAMILIAL: { titre: 'Partage avec la famille', texte: 'Permettre à ses proches de voir le suivi et de recevoir les alertes.' },
  VOIX: { titre: 'Voix d’un proche', texte: 'Utiliser l’enregistrement de la voix d’un proche pour les messages.' },
};
const ORDER: ConsentType[] = ['PARTAGE_FAMILIAL', 'RAPPELS', 'EXERCICES', 'VOIX'];

export default function Consents() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const [consents, setConsents] = useState<ConsentDto[] | null>(null);
  const [history, setHistory] = useState<ConsentHistoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<ConsentType | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, hist] = await Promise.all([aidantApi.consents(seniorId), aidantApi.consentHistory(seniorId)]);
      setConsents(list);
      setHistory(hist);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [seniorId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const change = (type: ConsentType, accorde: boolean) => {
    const { titre } = DESCRIPTIONS[type];
    Alert.alert(
      accorde ? `Accorder « ${titre} » ?` : `Retirer « ${titre} » ?`,
      'Confirmez que le senior est présent et que c’est bien son choix. Ce changement est enregistré.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Le senior est d’accord',
          onPress: async () => {
            setSaving(type);
            try {
              await aidantApi.setConsent(seniorId, type, accorde);
              await load();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setSaving(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Notice>Chaque accord est séparé : refuser l’un ne bloque pas les autres. Le senior peut changer d’avis à tout moment.</Notice>
      <ErrorText message={error} />
      {consents === null && !error ? <Loading /> : null}
      {consents
        ? ORDER.map((type) => {
            const consent = consents.find((x) => x.type === type);
            return (
              <Card key={type} title={DESCRIPTIONS[type].titre} right={
                <Switch
                  value={!!consent?.accorde}
                  disabled={saving !== null}
                  onValueChange={(value) => change(type, value)}
                  accessibilityLabel={DESCRIPTIONS[type].titre}
                  trackColor={{ true: c.primary }}
                />
              }>
                <Text style={styles.muted}>{DESCRIPTIONS[type].texte}</Text>
                <Text style={[styles.muted, { color: consent?.accorde ? '#1E8E3E' : c.muted }]}>
                  {consent?.accorde ? 'Accordé' : 'Non accordé'}
                  {consent?.dateMaj ? ` · ${formatDay(consent.dateMaj)}` : ''}
                </Text>
              </Card>
            );
          })
        : null}
      {history.length > 0 ? (
        <Card title="Journal">
          {history.slice(0, 15).map((h, i) => (
            <View key={i} style={{ paddingVertical: 2 }}>
              <Text style={styles.muted}>
                {formatDay(h.horodatage)} {formatTime(h.horodatage)} · {DESCRIPTIONS[h.type].titre} : {h.accorde ? 'accordé' : 'retiré'} (
                {h.canal === 'APP_SENIOR' ? 'par le senior' : 'par l’aidant, senior présent'})
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
