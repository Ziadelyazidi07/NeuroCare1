/**
 * Les 4 consentements, accordés ou retirés indépendamment (EF-CO-02). L'aidant enregistre le choix du
 * senior en sa présence : une confirmation explicite est demandée à chaque changement (cahier §7.2).
 */
import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import type { ConsentDto, ConsentHistoryDto, ConsentType } from '../../../api/types';
import { formatDay, formatTime } from '../../../lib/dates';
import { errorMessage } from '../../../lib/problem';
import { useLanguage } from '../../../i18n';
import { Card, colours as c, ErrorText, Loading, Notice, Screen, styles, Text } from '../../../theme';

const ORDER: ConsentType[] = ['PARTAGE_FAMILIAL', 'RAPPELS', 'EXERCICES', 'VOIX'];

export default function Consents() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const { t } = useLanguage();
  const items = t.consents.items;
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
      setError(errorMessage(e, t));
    }
  }, [seniorId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const change = (type: ConsentType, accorde: boolean) => {
    const { title } = items[type];
    Alert.alert(
      accorde ? t.consents.grantTitle(title) : t.consents.revokeTitle(title),
      t.consents.confirmText,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.consents.agree,
          onPress: async () => {
            setSaving(type);
            try {
              await aidantApi.setConsent(seniorId, type, accorde);
              await load();
            } catch (e) {
              setError(errorMessage(e, t));
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
      <Notice>{t.consents.intro}</Notice>
      <ErrorText message={error} />
      {consents === null && !error ? <Loading /> : null}
      {consents
        ? ORDER.map((type) => {
            const consent = consents.find((x) => x.type === type);
            return (
              <Card key={type} title={items[type].title} right={
                <Switch
                  value={!!consent?.accorde}
                  disabled={saving !== null}
                  onValueChange={(value) => change(type, value)}
                  accessibilityLabel={items[type].title}
                  trackColor={{ true: c.primary }}
                />
              }>
                <Text style={styles.muted}>{items[type].text}</Text>
                <Text style={[styles.muted, { color: consent?.accorde ? c.success : c.muted, fontWeight: '700' }]}>
                  {consent?.accorde ? t.consents.granted : t.consents.notGranted}
                  {consent?.dateMaj ? ` · ${formatDay(consent.dateMaj)}` : ''}
                </Text>
              </Card>
            );
          })
        : null}
      {history.length > 0 ? (
        <Card title={t.consents.log} icon="time">
          {history.slice(0, 15).map((h, i) => (
            <View key={i} style={{ paddingVertical: 2 }}>
              <Text style={styles.muted}>
                {t.consents.logLine(`${formatDay(h.horodatage)} ${formatTime(h.horodatage)}`, items[h.type].title, h.accorde, h.canal === 'APP_SENIOR')}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
