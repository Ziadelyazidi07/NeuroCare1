/** Code d'appairage du téléphone senior : 6 chiffres, valable 10 minutes, usage unique (EF-AU-04). */
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import type { DeviceDto, PairingCodeResponse } from '../../../api/types';
import { formatDay, formatTime, secondsUntil } from '../../../lib/dates';
import { errorMessage } from '../../../lib/problem';
import { useLanguage } from '../../../i18n';
import { Button, Card, colours as c, ErrorText, Notice, Screen, styles, Text } from '../../../theme';

export default function Pairing() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const { t } = useLanguage();
  const [pairing, setPairing] = useState<PairingCodeResponse | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<DeviceDto[]>([]);

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await aidantApi.devices(seniorId));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }, [seniorId, t]);

  useFocusEffect(
    useCallback(() => {
      void loadDevices();
    }, [loadDevices]),
  );

  const revoke = (device: DeviceDto) =>
    Alert.alert(t.pairing.revokeTitle, t.pairing.revokeText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.pairing.revoke,
        style: 'destructive',
        onPress: async () => {
          try {
            await aidantApi.revokeDevice(seniorId, device.id);
            await loadDevices();
          } catch (e) {
            setError(errorMessage(e, t));
          }
        },
      },
    ]);

  useEffect(() => {
    if (!pairing) return;
    const timer = setInterval(() => setRemaining(secondsUntil(pairing.expireLe)), 1000);
    return () => clearInterval(timer);
  }, [pairing]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await aidantApi.pairingCode(seniorId);
      setRemaining(secondsUntil(created.expireLe));
      setPairing(created);
      void loadDevices();
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const expired = pairing !== null && remaining === 0;

  return (
    <Screen>
      <Card title={t.pairing.title} icon="phone-portrait">
        <Text style={styles.text}>{t.pairing.help}</Text>
        {pairing && !expired ? (
          <>
            <Text
              style={{ fontSize: 48, fontWeight: '800', letterSpacing: 10, textAlign: 'center', color: c.primary }}
              accessibilityLabel={t.pairing.codeA11y(pairing.code.split('').join(' '))}
            >
              {pairing.code}
            </Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>
              {t.pairing.validFor(Math.floor(remaining / 60), String(remaining % 60).padStart(2, '0'))}
            </Text>
          </>
        ) : null}
        {expired ? <Text style={styles.muted}>{t.pairing.expired}</Text> : null}
        <ErrorText message={error} />
        <Button label={pairing ? t.pairing.newCode : t.pairing.code} onPress={() => void generate()} loading={busy} />
      </Card>
      <Card title={t.pairing.devices} icon="phone-portrait">
        {devices.length === 0 ? <Text style={styles.muted}>{t.pairing.noDevice}</Text> : null}
        {devices.map((d) => (
          <View key={d.id} style={{ gap: 6 }}>
            <Text style={styles.text}>
              {d.plateforme === 'IOS' ? 'iPhone' : 'Android'}
              {d.derniereActivite ? t.pairing.active(formatDay(d.derniereActivite), formatTime(d.derniereActivite)) : ''}
              {d.revoque ? t.pairing.revoked : ''}
            </Text>
            {!d.revoque ? <Button label={t.pairing.revoke} variant="secondary" onPress={() => revoke(d)} /> : null}
          </View>
        ))}
      </Card>
      <Notice>{t.pairing.notice}</Notice>
    </Screen>
  );
}
