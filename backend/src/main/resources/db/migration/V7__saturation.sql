-- Module 2 : saturation en oxygène (SpO2) et pouls, mesurés au repos.

CREATE TABLE spo2_profiles (
    id                             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- = senior
    maladie_respiratoire_chronique BOOLEAN NOT NULL,                  -- BPCO, insuffisance respiratoire
    mis_a_jour_le                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE spo2_measurements (
    id                             UUID PRIMARY KEY,
    senior_id                      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_mesure                    TIMESTAMPTZ NOT NULL DEFAULT now(),
    spo2                           SMALLINT NOT NULL CHECK (spo2 BETWEEN 50 AND 100),
    pouls                          SMALLINT NOT NULL CHECK (pouls BETWEEN 30 AND 220),
    maladie_respiratoire_chronique BOOLEAN NOT NULL,                  -- profil au moment de la mesure
    niveau                         VARCHAR(10) NOT NULL CHECK (niveau IN ('VERT', 'ORANGE', 'ROUGE')),
    saisi_par                      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_spo2_senior_date ON spo2_measurements (senior_id, date_mesure);
