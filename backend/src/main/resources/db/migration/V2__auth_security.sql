-- Étape 2 : compléments de sécurité (cahier §8.1)

-- Rotation des refresh tokens : un token réutilisé révoque toute sa famille (détection de vol).
ALTER TABLE refresh_tokens
    ADD COLUMN family_id     UUID        NOT NULL,
    ADD COLUMN date_creation TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_refresh_family ON refresh_tokens (family_id);

-- Recherche d'un code d'appairage actif par son empreinte.
CREATE INDEX idx_pairing_active ON pairing_codes (code_hash) WHERE utilise = FALSE;

-- Un token d'appareil identifie un seul appareil.
CREATE UNIQUE INDEX idx_devices_token ON devices (device_token_hash) WHERE device_token_hash IS NOT NULL;

-- EF-CO-03 : chaque changement historise aussi la version de la notice d'information.
ALTER TABLE consent_history ADD COLUMN version_texte VARCHAR(20) NOT NULL DEFAULT 'inconnue';
ALTER TABLE consent_history ALTER COLUMN version_texte DROP DEFAULT;

-- Liste des seniors suivis par un aidant.
CREATE INDEX idx_links_aidant ON caregiver_links (aidant_id);
