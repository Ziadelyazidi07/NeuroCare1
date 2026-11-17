package ma.neurocare.voice.api;

import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import ma.neurocare.common.exception.BusinessException;
import ma.neurocare.common.exception.ErrorCode;
import ma.neurocare.voice.infrastructure.storage.LocalObjectStorage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sert les fichiers du stockage local via URL signée (pas de JWT : la signature HMAC et l'expiration
 * tiennent lieu d'autorisation, comme une URL présignée S3). Actif seulement avec {@code provider=local}.
 */
@Hidden
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = "neurocare.storage.provider", havingValue = "local")
public class LocalAudioFileController {

    private final LocalObjectStorage storage;

    @GetMapping(LocalObjectStorage.FILES_PATH)
    public ResponseEntity<byte[]> file(@RequestParam String object, @RequestParam long exp,
                                       @RequestParam String sig) {
        byte[] content = storage.readSigned(object, exp, sig)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCESS_DENIED, "URL invalide ou expirée."));
        MediaType type = object.endsWith(".wav") ? MediaType.parseMediaType("audio/wav")
                : MediaType.parseMediaType("audio/mpeg");
        return ResponseEntity.ok().contentType(type).cacheControl(CacheControl.noStore()).body(content);
    }
}
