package ma.neurocare.voice.api.dto;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.voice.domain.AudioSource;
import ma.neurocare.voice.domain.VoiceProfileStatus;

/** DTO du module VOICE (cahier §7.5). */
public final class VoiceDtos {

    private VoiceDtos() {
    }

    public record VoiceProfileDto(UUID id, VoiceProfileStatus statut, Instant dateCreation) {
    }

    /** URL signée de courte durée (5 min) vers un fichier audio privé. */
    public record SignedAudioUrlDto(String url, Instant expireLe) {
    }

    /** Audio du rappel pour le téléphone du senior ; {@code extension} donne le format du fichier. */
    public record ReminderAudioDto(String url, Instant expireLe, String extension) {
    }

    /**
     * Aperçu du message d'un traitement. {@code url} est nulle au niveau 3 (PREENREGISTRE) :
     * l'application joue alors son audio générique embarqué.
     */
    public record AudioPreviewDto(UUID assetId, AudioSource source, String texte, String url, Instant expireLe) {
    }
}
