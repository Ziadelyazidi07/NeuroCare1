/**
 * Voix des rappels (EF-VO-01) : l'aidant enregistre ~12 s de sa voix (10 à 30 s acceptées), réécoute,
 * puis envoie. Le serveur exige le consentement VOIX ; sans clonage disponible, la voix de synthèse
 * standard est utilisée (repli niveau 2).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
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
import { Button, Card, ErrorText, Notice, Screen, styles } from '../../../ui/components';

const TARGET_MS = 12_000;
const STATUS_LABEL: Record<VoiceProfileDto['statut'], string> = {
  EN_COURS: 'En préparation…',
  PRET: 'Prête : les rappels utilisent votre voix.',
  ECHEC: 'Non disponible : les rappels utilisent la voix de synthèse.',
};

function mimeOf(uri: string): { type: string; name: string } {
  if (uri.endsWith('.wav')) return { type: 'audio/wav', name: 'voix.wav' };
  if (uri.endsWith('.mp3')) return { type: 'audio/mpeg', name: 'voix.mp3' };
  return { type: 'audio/mp4', name: 'voix.m4a' };
}

export default function Voice() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
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
      else setError(errorMessage(e));
    }
  }, [seniorId]);

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

  // Suivi du statut après l'envoi (EN_COURS → PRET ou ECHEC).
  useEffect(() => {
    if (profile?.statut !== 'EN_COURS') return;
    const timer = setInterval(() => void loadProfile(), 2000);
    return () => clearInterval(timer);
  }, [profile?.statut, loadProfile]);

  const start = async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("L'accès au micro est nécessaire pour enregistrer votre voix.");
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
    try {
      const { type, name } = mimeOf(recordingUri);
      setProfile(await aidantApi.uploadVoice(seniorId, recordingUri, type, name));
      setRecordingUri(null);
    } catch (e) {
      setConsentMissing(e instanceof ApiError && e.isConsentRequired);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('Supprimer votre voix ?', 'Les messages enregistrés avec votre voix seront aussi supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await aidantApi.deleteVoice(seniorId);
            setProfile(null);
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);

  const seconds = Math.floor(recorderState.durationMillis / 1000);

  return (
    <Screen>
      <Card title="Votre voix">
        <Text style={styles.text}>{profile ? STATUS_LABEL[profile.statut] : 'Aucune voix enregistrée : la voix de synthèse est utilisée.'}</Text>
        {profile ? <Button label="Supprimer ma voix" variant="secondary" onPress={remove} /> : null}
      </Card>

      <Card title="Enregistrer (environ 12 secondes)">
        <Text style={styles.muted}>Lisez calmement, dans un endroit silencieux :</Text>
        <Text style={[styles.text, { fontStyle: 'italic' }]}>
          « Bonjour, c’est moi. C’est l’heure de ton médicament. Prends ton temps, et appuie sur le gros bouton quand c’est
          fait. Je pense fort à toi. »
        </Text>
        {recorderState.isRecording ? (
          <>
            <Text style={[styles.cardTitle, { textAlign: 'center' }]} accessibilityLiveRegion="polite">
              Enregistrement… {seconds} s / {TARGET_MS / 1000} s
            </Text>
            <Button label="Arrêter" variant="danger" onPress={() => void stop()} />
          </>
        ) : (
          <Button label={recordingUri ? 'Recommencer' : 'Commencer l’enregistrement'} variant={recordingUri ? 'secondary' : 'primary'} onPress={() => void start()} />
        )}
        {recordingUri && !recorderState.isRecording ? (
          <>
            <Button label="Réécouter" variant="secondary" onPress={listen} />
            <Button label="Envoyer" onPress={() => void upload()} loading={busy} />
          </>
        ) : null}
        <ErrorText message={error} />
        {consentMissing ? <Notice>Le senior doit d’abord accorder le consentement « Voix d’un proche ».</Notice> : null}
      </Card>
      <Notice>La voix est une donnée sensible : elle n’est utilisée que pour les rappels et supprimée si le senior retire son accord.</Notice>
    </Screen>
  );
}
