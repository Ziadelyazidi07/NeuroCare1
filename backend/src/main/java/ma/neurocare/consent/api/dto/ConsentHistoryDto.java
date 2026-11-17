package ma.neurocare.consent.api.dto;

import java.time.Instant;
import java.util.UUID;

import ma.neurocare.consent.domain.ConsentChannel;
import ma.neurocare.consent.domain.ConsentType;

public record ConsentHistoryDto(
        ConsentType type,
        boolean accorde,
        String versionTexte,
        UUID auteurId,
        ConsentChannel canal,
        Instant horodatage) {
}
