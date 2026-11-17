/** Code d'appairage du téléphone senior : 6 chiffres, valable 10 minutes, usage unique (EF-AU-04). */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { aidantApi } from '../../../api/api';
import type { DeviceDto, PairingCodeResponse } from '../../../api/types';
import { formatDay, formatTime, secondsUntil } from '../../../lib/dates';
import { errorMessage } from '../../../lib/problem';
import { Button, Card, ErrorText, Notice, Screen, styles } from '../../../ui/components';
import { aidantColours as c } from '../../../ui/theme';

export default function Pairing() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const [pairing, setPairing] = useState<PairingCodeResponse | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<DeviceDto[]>([]);

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await aidantApi.devices(seniorId));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [seniorId]);

  useFocusEffect(
    useCallback(() => {
      void loadDevices();
    }, [loadDevices]),
  );

  const revoke = (device: DeviceDto) =>
    Alert.alert('Révoquer ce téléphone ?', 'Il ne pourra plus recevoir les rappels ni confirmer les prises (perte, vol).', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Révoquer',
        style: 'destructive',
        onPress: async () => {
          try {
            await aidantApi.revokeDevice(seniorId, device.id);
            await loadDevices();
          } catch (e) {
            setError(errorMessage(e));
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
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const expired = pairing !== null && remaining === 0;

  return (
    <Screen>
      <Card title="Appairer le téléphone du senior">
        <Text style={styles.text}>
          Sur le téléphone du senior : ouvrez NeuroCare, choisissez « Je suis senior » et saisissez ce code.
        </Text>
        {pairing && !expired ? (
          <>
            <Text
              style={{ fontSize: 48, fontWeight: '800', letterSpacing: 10, textAlign: 'center', color: c.primary }}
              accessibilityLabel={`Code ${pairing.code.split('').join(' ')}`}
            >
              {pairing.code}
            </Text>
            <Text style={[styles.muted, { textAlign: 'center' }]}>
              Valable encore {Math.floor(remaining / 60)} min {String(remaining % 60).padStart(2, '0')} s
            </Text>
          </>
        ) : null}
        {expired ? <Text style={styles.muted}>Ce code a expiré.</Text> : null}
        <ErrorText message={error} />
        <Button label={pairing ? 'Générer un nouveau code' : 'Générer un code'} onPress={() => void generate()} loading={busy} />
      </Card>
      <Card title="Téléphones appairés">
        {devices.length === 0 ? <Text style={styles.muted}>Aucun téléphone appairé.</Text> : null}
        {devices.map((d) => (
          <View key={d.id} style={{ gap: 6 }}>
            <Text style={styles.text}>
              {d.plateforme === 'IOS' ? 'iPhone' : 'Android'}
              {d.derniereActivite ? ` · actif le ${formatDay(d.derniereActivite)} à ${formatTime(d.derniereActivite)}` : ''}
              {d.revoque ? ' · révoqué' : ''}
            </Text>
            {!d.revoque ? <Button label="Révoquer" variant="secondary" onPress={() => revoke(d)} /> : null}
          </View>
        ))}
      </Card>
      <Notice>Un nouveau code annule le précédent. En cas de perte du téléphone, révoquez-le puis appairez le nouveau.</Notice>
    </Screen>
  );
}
