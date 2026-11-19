-- Module 5 : tension artérielle, mesures ponctuelles et protocole d'automesure sur 3 jours (18 mesures).

CREATE TABLE bp_series (
    id         UUID PRIMARY KEY,
    senior_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_debut DATE NOT NULL,                              -- jour 1 du protocole
    cree_le    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bp_series_senior ON bp_series (senior_id, cree_le);

CREATE TABLE bp_measurements (
    id          UUID PRIMARY KEY,
    senior_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_mesure TIMESTAMPTZ NOT NULL DEFAULT now(),
    tas         SMALLINT NOT NULL CHECK (tas BETWEEN 60 AND 260),
    tad         SMALLINT NOT NULL CHECK (tad BETWEEN 30 AND 160),
    pouls       SMALLINT NOT NULL CHECK (pouls BETWEEN 30 AND 220),
    niveau      VARCHAR(30) NOT NULL,
    serie_id    UUID REFERENCES bp_series(id) ON DELETE CASCADE, -- absent : mesure ponctuelle
    jour        SMALLINT CHECK (jour BETWEEN 1 AND 3),
    moment      VARCHAR(10) CHECK (moment IN ('MATIN', 'SOIR')),
    rang        SMALLINT CHECK (rang BETWEEN 1 AND 3),
    saisi_par   UUID REFERENCES users(id) ON DELETE SET NULL,
    CHECK ((serie_id IS NULL AND jour IS NULL AND moment IS NULL AND rang IS NULL)
        OR (serie_id IS NOT NULL AND jour IS NOT NULL AND moment IS NOT NULL AND rang IS NOT NULL)),
    UNIQUE (serie_id, jour, moment, rang)
);

CREATE INDEX idx_bp_measurements_senior_date ON bp_measurements (senior_id, date_mesure);
