-- Module 3 : santé mentale, questionnaire Mini-GDS puis GDS-15 (7 derniers jours).

CREATE TABLE gds_assessments (
    id             UUID PRIMARY KEY,
    senior_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_passation TIMESTAMPTZ NOT NULL DEFAULT now(),
    reponses       JSONB NOT NULL,                     -- code de question -> réponse Oui (true) / Non (false)
    score_mini_gds SMALLINT NOT NULL CHECK (score_mini_gds BETWEEN 0 AND 4),
    score_gds15    SMALLINT CHECK (score_gds15 BETWEEN 0 AND 15), -- absent si arrêt après la Mini-GDS
    niveau         VARCHAR(30) NOT NULL,
    saisi_par      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_gds_senior_date ON gds_assessments (senior_id, date_passation);
