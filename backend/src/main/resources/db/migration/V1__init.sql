-- NeuroCare — schéma initial (cahier des charges §6.3)
-- Écart assumé : audit_logs.acteur_id en ON DELETE SET NULL pour conserver l'action
-- anonymisée lors de la suppression d'un compte (cahier §6.5).

CREATE TYPE user_role    AS ENUM ('SENIOR','AIDANT','MEDECIN','ADMIN');
CREATE TYPE consent_type AS ENUM ('RAPPELS','EXERCICES','PARTAGE_FAMILIAL','VOIX');
CREATE TYPE dose_status  AS ENUM ('EN_ATTENTE','CONFIRME','SANS_REPONSE','DESACTIVE');
CREATE TYPE audio_source AS ENUM ('CLONE','TTS_STANDARD','PREENREGISTRE');

CREATE TABLE users (
    id             UUID PRIMARY KEY,
    nom_complet    VARCHAR(120) NOT NULL,
    telephone      VARCHAR(20) UNIQUE,                -- E.164, NULL possible pour un senior sans compte
    password_hash  VARCHAR(100),                      -- NULL pour SENIOR
    role           user_role    NOT NULL,
    actif          BOOLEAN      NOT NULL DEFAULT TRUE,
    failed_logins  SMALLINT     NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    date_creation  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    date_maj       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE senior_profiles (
    user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    langue                 VARCHAR(10)  NOT NULL DEFAULT 'DARIJA',
    fuseau                 VARCHAR(40)  NOT NULL DEFAULT 'Africa/Casablanca',
    taille_police          SMALLINT     NOT NULL DEFAULT 24,
    contraste_eleve        BOOLEAN      NOT NULL DEFAULT TRUE,
    delai_sans_reponse_min SMALLINT     NOT NULL DEFAULT 30,
    contact_urgence_nom    VARCHAR(120),
    contact_urgence_tel    VARCHAR(20),
    donnees_fictives       BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE TABLE caregiver_links (
    id                  UUID PRIMARY KEY,
    senior_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aidant_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lien_parente        VARCHAR(40),                  -- ex : fille, fils, voisin
    surnom_senior       VARCHAR(60),                  -- ex : "Baba", "Papa chéri"
    consentement_valide BOOLEAN NOT NULL DEFAULT FALSE,
    date_consentement   TIMESTAMPTZ,
    date_creation       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (senior_id, aidant_id)
);

CREATE TABLE consents (
    id            UUID PRIMARY KEY,
    senior_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          consent_type NOT NULL,
    accorde       BOOLEAN NOT NULL,
    version_texte VARCHAR(20) NOT NULL,               -- version de la notice d'information affichée
    date_maj      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (senior_id, type)
);

CREATE TABLE consent_history (
    id         BIGSERIAL PRIMARY KEY,
    consent_id UUID NOT NULL REFERENCES consents(id) ON DELETE CASCADE,
    accorde    BOOLEAN NOT NULL,
    auteur_id  UUID NOT NULL REFERENCES users(id),
    canal      VARCHAR(20) NOT NULL,                  -- APP_SENIOR, APP_AIDANT
    horodatage TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,           -- SHA-256
    expire_le  TIMESTAMPTZ NOT NULL,
    revoque    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE pairing_codes (
    id        UUID PRIMARY KEY,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    expire_le TIMESTAMPTZ NOT NULL,
    utilise   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE devices (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plateforme        VARCHAR(10) NOT NULL,           -- ANDROID, IOS
    fcm_token         VARCHAR(255),
    device_token_hash VARCHAR(64),                    -- token d'appareil senior
    revoque           BOOLEAN NOT NULL DEFAULT FALSE,
    derniere_activite TIMESTAMPTZ
);

CREATE TABLE medications (
    id             UUID PRIMARY KEY,
    senior_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_medicament VARCHAR(120) NOT NULL,
    consigne       VARCHAR(255),                      -- texte validé par un responsable, jamais calculé
    date_debut     DATE NOT NULL,
    date_fin       DATE,
    actif          BOOLEAN NOT NULL DEFAULT TRUE,
    cree_par       UUID NOT NULL REFERENCES users(id),
    date_creation  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medication_schedules (
    id            UUID PRIMARY KEY,
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    heure_rappel  TIME NOT NULL,
    jours_semaine SMALLINT NOT NULL DEFAULT 127       -- masque binaire lun=1 ... dim=64
);

CREATE TABLE dose_events (
    id                   UUID PRIMARY KEY,
    schedule_id          UUID NOT NULL REFERENCES medication_schedules(id) ON DELETE CASCADE,
    senior_id            UUID NOT NULL REFERENCES users(id),
    date_prevue          TIMESTAMPTZ NOT NULL,
    statut               dose_status NOT NULL DEFAULT 'EN_ATTENTE',
    horodatage_action    TIMESTAMPTZ,
    relance_envoyee      BOOLEAN NOT NULL DEFAULT FALSE,
    notification_envoyee BOOLEAN NOT NULL DEFAULT FALSE,
    client_request_id    VARCHAR(64),                 -- idempotence des confirmations hors ligne
    version              INTEGER NOT NULL DEFAULT 0,  -- verrou optimiste
    UNIQUE (schedule_id, date_prevue)
);

CREATE INDEX idx_dose_senior_date ON dose_events (senior_id, date_prevue);
CREATE INDEX idx_dose_pending     ON dose_events (statut, date_prevue) WHERE statut = 'EN_ATTENTE';

CREATE TABLE voice_profiles (
    id                UUID PRIMARY KEY,
    caregiver_link_id UUID NOT NULL REFERENCES caregiver_links(id) ON DELETE CASCADE,
    echantillon_key   VARCHAR(255) NOT NULL,          -- clé objet MinIO/S3
    provider_voice_id VARCHAR(120),                   -- id renvoyé par le service IA
    statut            VARCHAR(20) NOT NULL,           -- EN_COURS, PRET, ECHEC
    date_creation     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audio_assets (
    id               UUID PRIMARY KEY,
    medication_id    UUID REFERENCES medications(id) ON DELETE CASCADE,
    voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
    langue           VARCHAR(10)  NOT NULL,
    texte            VARCHAR(300) NOT NULL,
    source           audio_source NOT NULL,
    storage_key      VARCHAR(255) NOT NULL,
    duree_ms         INTEGER,
    date_creation    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cognitive_sessions (
    id            UUID PRIMARY KEY,
    senior_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_exercice TIMESTAMPTZ NOT NULL DEFAULT now(),
    type_exercice VARCHAR(40) NOT NULL,               -- RAPPEL_MOTS, ASSOCIATION_VISUELLE
    langue        VARCHAR(10) NOT NULL,
    resultat_brut JSONB NOT NULL,                     -- données d'exécution sans interprétation clinique
    taux_reussite NUMERIC(5,2),
    duree_sec     INTEGER,
    interrompu    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_cogni_senior_date ON cognitive_sessions (senior_id, date_exercice);

CREATE TABLE audit_logs (
    id         BIGSERIAL PRIMARY KEY,
    acteur_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(60) NOT NULL,                  -- ex : READ_DASHBOARD, EXPORT_PDF
    cible_type VARCHAR(40),
    cible_id   UUID,
    ip         VARCHAR(45),
    horodatage TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table requise par ShedLock
CREATE TABLE shedlock (
    name       VARCHAR(64)  PRIMARY KEY,
    lock_until TIMESTAMP    NOT NULL,
    locked_at  TIMESTAMP    NOT NULL,
    locked_by  VARCHAR(255) NOT NULL
);
