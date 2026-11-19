-- Son des rappels choisi pour chaque senior : son standard ou voix personnalisée de l'aidant.
ALTER TABLE senior_profiles ADD COLUMN mode_son_rappel VARCHAR(20) NOT NULL DEFAULT 'STANDARD'
    CHECK (mode_son_rappel IN ('STANDARD', 'PERSONNALISE'));

-- Les seniors dont les rappels utilisent déjà une voix clonée la conservent.
UPDATE senior_profiles sp
SET mode_son_rappel = 'PERSONNALISE'
WHERE EXISTS (SELECT 1
              FROM voice_profiles vp
                       JOIN caregiver_links cl ON cl.id = vp.caregiver_link_id
              WHERE cl.senior_id = sp.user_id
                AND vp.statut = 'PRET');
