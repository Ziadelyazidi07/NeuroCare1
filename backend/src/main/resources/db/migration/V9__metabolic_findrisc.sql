-- Module 4 : pré-dépistage du diabète de type 2, score FINDRISC (8 questions, 26 points).

CREATE TABLE findrisc_assessments (
    id                          UUID PRIMARY KEY,
    senior_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_passation              TIMESTAMPTZ NOT NULL DEFAULT now(),
    age                         SMALLINT NOT NULL CHECK (age BETWEEN 18 AND 120),
    sexe                        VARCHAR(10) NOT NULL CHECK (sexe IN ('HOMME', 'FEMME')),
    poids_kg                    NUMERIC(5,1) NOT NULL,
    taille_cm                   NUMERIC(5,1) NOT NULL,
    imc                         NUMERIC(4,1) NOT NULL,
    tour_taille_cm              SMALLINT NOT NULL,
    activite_physique           BOOLEAN NOT NULL,
    fruits_legumes_quotidiens   BOOLEAN NOT NULL,
    medicaments_hypertension    BOOLEAN NOT NULL,
    glycemie_elevee_antecedent  BOOLEAN NOT NULL,
    antecedents_familiaux       VARCHAR(20) NOT NULL CHECK (antecedents_familiaux IN ('AUCUN', 'ELOIGNES', 'PROCHES')),
    points                      JSONB NOT NULL,                -- détail des points par question
    score_total                 SMALLINT NOT NULL CHECK (score_total BETWEEN 0 AND 26),
    niveau                      VARCHAR(30) NOT NULL,
    saisi_par                   UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_findrisc_senior_date ON findrisc_assessments (senior_id, date_passation);
