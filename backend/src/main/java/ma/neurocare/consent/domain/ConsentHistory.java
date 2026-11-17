package ma.neurocare.consent.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

/**
 * Journal immuable des changements de consentement (table {@code consent_history}, EF-CO-03).
 */
@Entity
@Immutable
@Table(name = "consent_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConsentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "consent_id", nullable = false, updatable = false)
    private Consent consent;

    @Column(name = "accorde", nullable = false, updatable = false)
    private boolean accorde;

    @Column(name = "version_texte", nullable = false, updatable = false, length = 20)
    private String versionTexte;

    @Column(name = "auteur_id", nullable = false, updatable = false)
    private UUID auteurId;

    @Enumerated(EnumType.STRING)
    @Column(name = "canal", nullable = false, updatable = false, length = 20)
    private ConsentChannel canal;

    @Column(name = "horodatage", nullable = false, updatable = false)
    private Instant horodatage = Instant.now();

    public ConsentHistory(Consent consent, boolean accorde, String versionTexte, UUID auteurId,
                          ConsentChannel canal) {
        this.consent = consent;
        this.accorde = accorde;
        this.versionTexte = versionTexte;
        this.auteurId = auteurId;
        this.canal = canal;
    }
}
