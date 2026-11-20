/**
 * Voix des rappels (EF-VO-01) : l'aidant enregistre ~12 s de sa voix (10 à 30 s acceptées), réécoute,
 * envoie, remplace ou supprime. Le serveur exige le consentement VOIX. Le senior entend cette voix ;
 * tant qu'il n'y en a pas, son téléphone joue une simple tonalité.
 */
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';

import { aidantApi } from '../../../api/api';
import type { VoiceProfileDto } from '../../../api/types';
import { ApiError, errorMessage } from '../../../lib/problem';
import { useLanguage } from '../../../i18n';
import { Button, Card, ErrorText, Notice, Screen, styles, Text } from '../../../theme';

const TARGET_MS = 12_000;

export default function Voice() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const { t } = useLanguage();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [profile, setProfile] = useState<VoiceProfileDto | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentMissing, setConsentMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await aidantApi.voiceProfile(seniorId));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setProfile(null);
      else setError(errorMessage(e, t));
    }
  }, [seniorId, t]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      return () => {
        player.current?.remove();
        if (autoStop.current) clearTimeout(autoStop.current);
      };
    }, [loadProfile]),
  );

  const stop = useCallback(async () => {
    if (autoStop.current) clearTimeout(autoStop.current);
    autoStop.current = null;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setRecordingUri(recorder.uri);
  }, [recorder]);

  const start = async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(t.voice.micRequired);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setRecordingUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
    // Arrêt automatique après ~12 s (10 à 30 s acceptées par le serveur).
    autoStop.current = setTimeout(() => void stop(), TARGET_MS);
  };

  const listen = () => {
    if (!recordingUri) return;
    player.current?.remove();
    player.current = createAudioPlayer(recordingUri);
    player.current.play();
  };

  const upload = async () => {
    if (!recordingUri) return;
    setBusy(true);
    setError(null);
    setConsentMissing(false);
    try {
      setProfile(await aidantApi.uploadVoice(seniorId, recordingUri));
      setRecordingUri(null);
    } catch (e) {
      setConsentMissing(e instanceof ApiError && e.isConsentRequired);
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(t.voice.deleteTitle, t.voice.deleteText, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.voice.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await aidantApi.deleteVoice(seniorId);
            setProfile(null);
          } catch (e) {
            setError(errorMessage(e, t));
          }
        },
      },
    ]);

  const seconds = Math.floor(recorderState.durationMillis / 1000);
  const startLabel = recordingUri ? t.voice.restart : profile ? t.voice.replace : t.voice.start;

  return (
    <Screen>
      <Card title={t.voice.yours} icon="person-circle">
        <Text style={styles.text}>{profile ? t.voice.saved : t.voice.none}</Text>
        {profile ? <Button label={t.voice.deleteMine} variant="secondary" onPress={remove} /> : null}
      </Card>

      <Card title={t.voice.recordTitle} icon="mic">
        <Text style={styles.muted}>{t.voice.readCalmly}</Text>
        <Text style={[styles.text, { fontStyle: 'italic' }]}>{t.voice.script}</Text>
        {recorderState.isRecording ? (
          <>
            <Text style={[styles.cardTitle, { textAlign: 'center' }]} accessibilityLiveRegion="polite">
              {t.voice.recording(seconds, TARGET_MS / 1000)}
            </Text>
            <Button label={t.voice.stop} variant="danger" onPress={() => void stop()} />
          </>
        ) : (
          <Button label={startLabel} variant={recordingUri || profile ? 'secondary' : 'primary'} onPress={() => void start()} />
        )}
        {recordingUri && !recorderState.isRecording ? (
          <>
            <Button label={t.voice.listen} variant="secondary" onPress={listen} />
            <Button label={t.voice.send} onPress={() => void upload()} loading={busy} />
          </>
        ) : null}
        <ErrorText message={error} />
        {consentMissing ? <Notice>{t.voice.consentRequired}</Notice> : null}
      </Card>
      <Notice>{t.voice.sensitive}</Notice>
    </Screen>
  );
}
