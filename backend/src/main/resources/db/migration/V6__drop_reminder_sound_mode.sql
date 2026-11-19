-- Les rappels jouent uniquement la voix de l'aidant : plus de choix de son à conserver.
ALTER TABLE senior_profiles DROP COLUMN mode_son_rappel;
