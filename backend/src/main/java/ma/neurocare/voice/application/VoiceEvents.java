package ma.neurocare.voice.application;

import java.util.List;
import java.util.UUID;

import ma.neurocare.voice.domain.VoiceProfileStatus;

/** Événements internes du module voice. */
public final class VoiceEvents {

    private VoiceEvents() {
    }

    /** Échantillon stocké : l'enrôlement auprès du microservice part après commit (asynchrone). */
    public record VoiceSampleUploaded(UUID voiceProfileId, UUID seniorId) {
    }

    /** Profil vocal PRET ou ECHEC (événement VOICE_PROFILE_READY pour le temps réel). */
    public record VoiceProfileStatusChanged(UUID voiceProfileId, UUID seniorId, VoiceProfileStatus statut) {
    }

    /** L'aidant ou le senior a supprimé la voix : le téléphone du senior doit oublier sa copie. */
    public record VoiceRemoved(UUID seniorId) {
    }

    /**
     * Données vocales à effacer après commit : échantillons, audios clonés et voix côté microservice
     * (EF-CO-05, révocation de VOIX ou suppression du profil).
     */
    public record VoiceDataPurgeRequested(List<String> sampleKeys, List<String> assetKeys,
                                          List<String> providerVoiceIds) {
    }
}
