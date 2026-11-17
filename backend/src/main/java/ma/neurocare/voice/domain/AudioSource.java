package ma.neurocare.voice.domain;

/**
 * Type PostgreSQL {@code audio_source}, dans l'ordre de la chaîne de repli (cahier §10.4).
 */
public enum AudioSource {
    CLONE,
    TTS_STANDARD,
    PREENREGISTRE
}
