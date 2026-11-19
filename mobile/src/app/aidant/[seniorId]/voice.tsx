/**
 * Voix des rappels (EF-VO-01) : choix entre le son standard et la voix personnalisée. Pour cette
 * dernière, l'aidant enregistre ~12 s de sa voix (10 à 30 s acceptées), réécoute, puis envoie. Le serveur
 * exige le consentement VOIX ; sans clonage disponible, l'enregistrement est joué tel quel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
import type { ReminderSoundMode, VoiceProfileDto } from '../../../api/types';
import { ApiError, errorMessage } from '../../../lib/problem';
import { REMINDER_SOUND_OPTIONS } from '../../../lib/reminderSound';
import { Button, Card, ErrorText, Loading, Notice, RadioOption, Screen, styles } from '../../../ui/components';

const TARGET_MS = 12_000;
const STATUS_LABEL: Record<VoiceProfileDto['statut'], string> = {
  EN_COURS: 'Enregistrement reçu : les rappels utilisent votre voix.',
  PRET: 'Prête : les rappels utilisent votre voix.',
  ECHEC: 'Enregistrement reçu : il est joué tel quel pour les rappels.',
};

export default function Voice() {
  const { seniorId } = useLocalSearchParams<{ seniorId: string }>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [profile, setProfile] = useState<VoiceProfileDto | null>(null);
  const [soundMode, setSoundMode] = useState<ReminderSoundMode | null>(null);
  const [savingSound, setSavingSound] = useState(false);
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

  const loadSoundMode = useCallback(async () => {
    try {
      setSoundMode((await aidantApi.senior(seniorId)).modeSonRappel);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [seniorId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void loadSoundMode();
      return () => {
        player.current?.remove();
        if (autoStop.current) clearTimeout(autoStop.current);
      };
    }, [loadProfile, loadSoundMode]),
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

  const chooseSound = async (mode: ReminderSoundMode) => {
    if (mode === soundMode) return;
    setSavingSound(true);
    setError(null);
    try {
      setSoundMode((await aidantApi.setReminderSound(seniorId, mode)).modeSonRappel);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSavingSound(false);
    }
  };

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
      setProfile(await aidantApi.uploadVoice(seniorId, recordingUri));
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
      <Card title="Son des rappels">
        {soundMode ? (
          <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
            {REMINDER_SOUND_OPTIONS.map((option) => (
              <RadioOption
                key={option.mode}
                label={option.label}
                description={option.description}
                selected={soundMode === option.mode}
                disabled={savingSound || recorderState.isRecording}
                onPress={() => void chooseSound(option.mode)}
              />
            ))}
          </View>
        ) : error ? null : (
          <Loading />
        )}
        {soundMode !== 'PERSONNALISE' ? <ErrorText message={error} /> : null}
      </Card>

      {soundMode === 'PERSONNALISE' ? (
        <>
          <Card title="Votre voix">
            <Text style={styles.text}>{profile ? STATUS_LABEL[profile.statut] : 'Aucune voix enregistrée : le son standard est joué en attendant.'}</Text>
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
        </>
      ) : null}
    </Screen>
  );
}
