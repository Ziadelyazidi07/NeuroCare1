-- Étape 6 : l'en-tête du rapport PDF affiche l'âge du senior (cahier §11.1).
-- Minimisation (§13.2) : seule l'année de naissance est conservée, jamais la date exacte.
ALTER TABLE senior_profiles ADD COLUMN annee_naissance SMALLINT
    CHECK (annee_naissance IS NULL OR annee_naissance BETWEEN 1900 AND 2100);
