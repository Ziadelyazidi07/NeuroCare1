package ma.neurocare.voice.api;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.medication.application.MedicationService;
import ma.neurocare.security.CurrentUser;
import ma.neurocare.voice.api.dto.VoiceDtos.AudioPreviewDto;
import ma.neurocare.voice.api.dto.VoiceDtos.ReminderAudioDto;
import ma.neurocare.voice.api.dto.VoiceDtos.SignedAudioUrlDto;
import ma.neurocare.voice.api.dto.VoiceDtos.VoiceProfileDto;
import ma.neurocare.voice.application.AudioGenerationService;
import ma.neurocare.voice.application.AudioGenerationService.AudioResult;
import ma.neurocare.voice.application.AudioGenerationService.ReminderAudio;
import ma.neurocare.voice.application.VoiceService;
import ma.neurocare.voice.infrastructure.storage.ObjectStorage.SignedUrl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Voix et audio", description = "Voix d'un proche pour les rappels ; repli TTS puis audio préenregistré")
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceService voiceService;
    private final AudioGenerationService audioGeneration;
    private final MedicationService medicationService;

    @Operation(summary = "Upload de l'échantillon vocal (WAV/MP3/M4A, 10–30 s, ≤ 5 Mo) — AIDANT lié + VOIX",
            description = "Réponse 202 : le profil est EN_COURS puis passe PRET ou ECHEC.")
    @PostMapping(path = "/seniors/{seniorId}/voice-profile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@accessPolicy.canUploadVoice(#seniorId, authentication)")
    public ResponseEntity<VoiceProfileDto> upload(@PathVariable UUID seniorId,
                                                  @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(voiceService.upload(seniorId, file, CurrentUser.get()));
    }

    @Operation(summary = "Statut du profil vocal (EN_COURS, PRET, ECHEC)")
    @GetMapping("/seniors/{seniorId}/voice-profile")
    @PreAuthorize("@accessPolicy.isLinkedCaregiver(#seniorId, authentication)")
    public VoiceProfileDto current(@PathVariable UUID seniorId) {
        return voiceService.current(seniorId);
    }

    @Operation(summary = "Supprime la voix et les audios générés avec elle (AIDANT lié ou SENIOR)")
    @DeleteMapping("/seniors/{seniorId}/voice-profile")
    @PreAuthorize("@accessPolicy.isSelfOrLinkedCaregiver(#seniorId, authentication)")
    public ResponseEntity<Void> delete(@PathVariable UUID seniorId) {
        voiceService.delete(seniorId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Génère (ou relit en cache) le message vocal d'un traitement")
    @PostMapping("/medications/{id}/audio/preview")
    @PreAuthorize("@accessPolicy.canManageMedications(@medicationService.seniorIdOf(#id), authentication)")
    public AudioPreviewDto preview(@PathVariable UUID id) {
        AudioResult result = audioGeneration.audioForMedication(id);
        return result.file()
                .map(asset -> {
                    SignedUrl url = audioGeneration.signedUrl(asset);
                    return new AudioPreviewDto(asset.getId(), result.source(), result.texte(), url.url(), url.expireLe());
                })
                .orElseGet(() -> new AudioPreviewDto(null, result.source(), result.texte(), null, null));
    }

    @Operation(summary = "Audio du rappel d'un traitement pour le téléphone du senior (cache uniquement)",
            description = "Téléchargé à l'avance pour les rappels hors ligne (cahier §9.5). 404 si aucun "
                    + "fichier n'est prêt : l'application joue alors son audio générique embarqué.")
    @GetMapping("/me/medications/{medicationId}/audio")
    public ReminderAudioDto myMedicationAudio(@PathVariable UUID medicationId) {
        if (!CurrentUser.get().userId().equals(medicationService.seniorIdOf(medicationId))) {
            throw BusinessException.notFound("Traitement introuvable.");
        }
        ReminderAudio audio = audioGeneration.cachedReminderAudio(medicationId)
                .orElseThrow(() -> BusinessException.notFound("Aucun audio prêt pour ce traitement."));
        return new ReminderAudioDto(audio.url().url(), audio.url().expireLe(), audio.extension());
    }

    @Operation(summary = "URL signée (5 min) vers un fichier audio")
    @GetMapping("/audio/{assetId}")
    @PreAuthorize("@accessPolicy.canViewMedications(@audioGenerationService.seniorIdOfAsset(#assetId), authentication)")
    public SignedAudioUrlDto signedUrl(@PathVariable UUID assetId) {
        SignedUrl url = audioGeneration.signedUrl(audioGeneration.asset(assetId));
        return new SignedAudioUrlDto(url.url(), url.expireLe());
    }
}
