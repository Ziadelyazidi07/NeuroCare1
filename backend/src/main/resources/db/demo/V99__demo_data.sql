-- =====================================================================================
-- NeuroCare — données de DÉMONSTRATION (profil Spring « demo » uniquement)
-- Scénario du cahier §2.2 : « Hajj Ahmed, 74 ans » et sa fille aidante « Salma ».
-- TOUTES LES DONNÉES SONT FICTIVES (senior_profiles.donnees_fictives = TRUE).
-- Identifiants publics, documentés dans docs/demo.md : ne jamais charger en production.
-- Les dates sont relatives au moment de l'application du script (premier démarrage).
-- =====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt() BCrypt et digest() SHA-256

-- ---------- Comptes ----------
-- Salma B., aidante — téléphone +212600000001, mot de passe « NeuroCare-Demo-2026 » (BCrypt coût 12).
INSERT INTO users (id, nom_complet, telephone, password_hash, role)
VALUES ('0d000000-0000-4000-8000-000000000001', 'Salma B.', '+212600000001',
        crypt('NeuroCare-Demo-2026', gen_salt('bf', 12)), 'AIDANT');

-- Hajj Ahmed, senior — pas de mot de passe (téléphone appairé).
INSERT INTO users (id, nom_complet, telephone, password_hash, role)
VALUES ('0d000000-0000-4000-8000-000000000002', 'Hajj Ahmed', NULL, NULL, 'SENIOR');

INSERT INTO senior_profiles (user_id, langue, fuseau, taille_police, contraste_eleve, delai_sans_reponse_min,
                             contact_urgence_nom, contact_urgence_tel, donnees_fictives, annee_naissance)
VALUES ('0d000000-0000-4000-8000-000000000002', 'DARIJA', 'Africa/Casablanca', 28, TRUE, 30,
        'Salma B.', '+212600000001', TRUE, 1952);

-- ---------- Paire et consentements (tous accordés, en présence du senior) ----------
INSERT INTO caregiver_links (id, senior_id, aidant_id, lien_parente, surnom_senior, consentement_valide,
                             date_consentement, date_creation)
VALUES ('0d000000-0000-4000-8000-000000000003', '0d000000-0000-4000-8000-000000000002',
        '0d000000-0000-4000-8000-000000000001', 'fille', 'Baba', TRUE, now() - interval '35 days',
        now() - interval '35 days');

INSERT INTO consents (id, senior_id, type, accorde, version_texte, date_maj)
VALUES ('0d000000-0000-4000-8000-000000000010', '0d000000-0000-4000-8000-000000000002', 'RAPPELS', TRUE, 'v1-demo', now() - interval '35 days'),
       ('0d000000-0000-4000-8000-000000000011', '0d000000-0000-4000-8000-000000000002', 'EXERCICES', TRUE, 'v1-demo', now() - interval '35 days'),
       ('0d000000-0000-4000-8000-000000000012', '0d000000-0000-4000-8000-000000000002', 'PARTAGE_FAMILIAL', TRUE, 'v1-demo', now() - interval '35 days'),
       ('0d000000-0000-4000-8000-000000000013', '0d000000-0000-4000-8000-000000000002', 'VOIX', TRUE, 'v1-demo', now() - interval '35 days');

INSERT INTO consent_history (consent_id, accorde, version_texte, auteur_id, canal, horodatage)
SELECT id, TRUE, 'v1-demo', '0d000000-0000-4000-8000-000000000001', 'APP_AIDANT', now() - interval '35 days'
FROM consents WHERE senior_id = '0d000000-0000-4000-8000-000000000002';

-- ---------- Téléphone du senior déjà appairé ----------
-- Token d'appareil de démo : « ncd_demo-hajj-ahmed-NE-PAS-UTILISER-EN-PRODUCTION » (stocké haché).
INSERT INTO devices (id, user_id, plateforme, device_token_hash, derniere_activite)
VALUES ('0d000000-0000-4000-8000-000000000020', '0d000000-0000-4000-8000-000000000002', 'ANDROID',
        encode(digest('ncd_demo-hajj-ahmed-NE-PAS-UTILISER-EN-PRODUCTION', 'sha256'), 'hex'), now());

-- ---------- Traitement suivi depuis 3 semaines ----------
INSERT INTO medications (id, senior_id, nom_medicament, consigne, date_debut, actif, cree_par, date_creation)
VALUES ('0d000000-0000-4000-8000-000000000030', '0d000000-0000-4000-8000-000000000002', 'Metformine 500',
        '1 comprimé pendant le repas', (now() AT TIME ZONE 'Africa/Casablanca')::date - 21, TRUE,
        '0d000000-0000-4000-8000-000000000001', now() - interval '21 days');

INSERT INTO medication_schedules (id, medication_id, heure_rappel, jours_semaine)
VALUES ('0d000000-0000-4000-8000-000000000031', '0d000000-0000-4000-8000-000000000030', '08:00', 127),
       ('0d000000-0000-4000-8000-000000000032', '0d000000-0000-4000-8000-000000000030', '20:00', 127);

-- Historique des 14 derniers jours (et des prises déjà passées aujourd'hui) : surtout CONFIRME,
-- quelques SANS_REPONSE, une DESACTIVE. Motif déterministe pour une démo reproductible.
WITH params AS (SELECT (now() AT TIME ZONE 'Africa/Casablanca')::date AS today),
     slots AS (
         SELECT p.today, d, s.id AS schedule_id,
                CASE WHEN s.heure_rappel = '08:00' THEN 0 ELSE 1 END AS slot,
                ((p.today - d) + s.heure_rappel) AT TIME ZONE 'Africa/Casablanca' AS prevue
         FROM params p
         CROSS JOIN generate_series(0, 14) AS d
         JOIN medication_schedules s ON s.medication_id = '0d000000-0000-4000-8000-000000000030'
     ),
     past AS (
         SELECT *,
                CASE WHEN d = 10 AND slot = 1 THEN 'DESACTIVE'
                     WHEN (d * 2 + slot) % 9 = 4 THEN 'SANS_REPONSE'
                     ELSE 'CONFIRME' END AS statut
         FROM slots
         WHERE prevue < now() - interval '1 hour'
     )
INSERT INTO dose_events (id, schedule_id, senior_id, date_prevue, statut, horodatage_action,
                         notification_envoyee, relance_envoyee, client_request_id)
SELECT gen_random_uuid(), schedule_id, '0d000000-0000-4000-8000-000000000002', prevue,
       statut::dose_status,
       CASE WHEN statut = 'CONFIRME' THEN prevue + make_interval(mins => ((d * 7 + slot * 3) % 12) + 1) END,
       statut <> 'DESACTIVE',
       statut = 'SANS_REPONSE',
       CASE WHEN statut = 'CONFIRME' THEN 'demo-' || d || '-' || slot END
FROM past;

-- ---------- Rappels « en direct » pour la démonstration de 3 minutes ----------
-- Créés pour le jour du démarrage uniquement ; le moteur génère leurs prises au démarrage.
-- 1) T+2 min : Salma montre la pastille verte quand Hajj Ahmed appuie sur « C'est fait ».
-- 2) T+4 min : laissé sans réponse → pastille orange et alerte (délai de 1 min en profil demo).
INSERT INTO medications (id, senior_id, nom_medicament, consigne, date_debut, date_fin, actif, cree_par)
VALUES ('0d000000-0000-4000-8000-000000000040', '0d000000-0000-4000-8000-000000000002', 'Vitamine D',
        '1 ampoule le matin', (now() AT TIME ZONE 'Africa/Casablanca')::date,
        (now() AT TIME ZONE 'Africa/Casablanca')::date, TRUE, '0d000000-0000-4000-8000-000000000001'),
       ('0d000000-0000-4000-8000-000000000050', '0d000000-0000-4000-8000-000000000002', 'Amlodipine 5',
        '1 comprimé', (now() AT TIME ZONE 'Africa/Casablanca')::date,
        (now() AT TIME ZONE 'Africa/Casablanca')::date, TRUE, '0d000000-0000-4000-8000-000000000001');

INSERT INTO medication_schedules (id, medication_id, heure_rappel, jours_semaine)
VALUES ('0d000000-0000-4000-8000-000000000041', '0d000000-0000-4000-8000-000000000040',
        date_trunc('minute', (now() AT TIME ZONE 'Africa/Casablanca') + interval '2 minutes')::time, 127),
       ('0d000000-0000-4000-8000-000000000051', '0d000000-0000-4000-8000-000000000050',
        date_trunc('minute', (now() AT TIME ZONE 'Africa/Casablanca') + interval '4 minutes')::time, 127);

-- ---------- Exercices de rappel de mots (5 semaines, résultats bruts) ----------
INSERT INTO cognitive_sessions (id, senior_id, date_exercice, type_exercice, langue, resultat_brut,
                                taux_reussite, duree_sec, interrompu)
VALUES
  (gen_random_uuid(), '0d000000-0000-4000-8000-000000000002', now() - interval '33 days 2 hours', 'RAPPEL_MOTS', 'DARIJA',
   '{"mots_presentes":["khobz","bab","chems"],"propositions":["khobz","ma","bab","kas","chems","dar","zit","ward","qmar"],"mots_choisis":["khobz","bab","chems"],"corrects":3,"delai_rappel_sec":60,"temps_reponse_ms":[2900,3600,4200]}',
   100.00, 92, FALSE),
  (gen_random_uuid(), '0d000000-0000-4000-8000-000000000002', now() - interval '26 days 3 hours', 'RAPPEL_MOTS', 'DARIJA',
   '{"mots_presentes":["dar","zit","ward"],"propositions":["atay","dar","korsi","zit","bhar","ward","hlib","ktab","ttir"],"mots_choisis":["dar","ward","ktab"],"corrects":2,"delai_rappel_sec":60,"temps_reponse_ms":[3100,4800,7200]}',
   66.67, 101, FALSE),
  (gen_random_uuid(), '0d000000-0000-4000-8000-000000000002', now() - interval '19 days 1 hour', 'RAPPEL_MOTS', 'DARIJA',
   '{"mots_presentes":["qmar","kas","sukkar"],"propositions":["qmar","sarut","kas","chajra","sukkar","mech","flouka","zerbiya","teffaha"],"mots_choisis":["qmar","kas","sukkar"],"corrects":3,"delai_rappel_sec":60,"temps_reponse_ms":[2700,3900,4400]}',
   100.00, 88, FALSE),
  (gen_random_uuid(), '0d000000-0000-4000-8000-000000000002', now() - interval '12 days 4 hours', 'RAPPEL_MOTS', 'DARIJA',
   '{"mots_presentes":["bhar","hlib","ttir"],"propositions":["bhar","khobz","hlib","bechkir","ttir","magana","atay","bab","dar"],"mots_choisis":["bhar"],"corrects":1,"delai_rappel_sec":60,"temps_reponse_ms":[5100]}',
   NULL, 40, TRUE),
  (gen_random_uuid(), '0d000000-0000-4000-8000-000000000002', now() - interval '5 days 2 hours', 'RAPPEL_MOTS', 'DARIJA',
   '{"mots_presentes":["ktab","korsi","atay"],"propositions":["ktab","chems","korsi","zit","atay","ma","ward","qmar","kas"],"mots_choisis":["ktab","atay","zit"],"corrects":2,"delai_rappel_sec":60,"temps_reponse_ms":[3300,5200,6800]}',
   66.67, 97, FALSE),
  (gen_random_uuid(), '0d000000-0000-4000-8000-000000000002', now() - interval '2 days 3 hours', 'RAPPEL_MOTS', 'DARIJA',
   '{"mots_presentes":["teffaha","sarut","bab"],"propositions":["teffaha","dar","sarut","hlib","bab","bhar","chajra","sukkar","ttir"],"mots_choisis":["teffaha","sarut","bab"],"corrects":3,"delai_rappel_sec":60,"temps_reponse_ms":[2600,3500,4100]}',
   100.00, 85, FALSE);
