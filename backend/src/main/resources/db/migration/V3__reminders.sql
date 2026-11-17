-- Étape 3 : traitements et moteur de rappel

-- Un horaire retiré d'un traitement est désactivé (et non supprimé) : la suppression
-- effacerait en cascade l'historique des prises (dose_events.schedule_id ON DELETE CASCADE).
ALTER TABLE medication_schedules ADD COLUMN actif BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX idx_medications_senior ON medications (senior_id);
CREATE INDEX idx_schedules_medication ON medication_schedules (medication_id);
CREATE INDEX idx_dose_schedule ON dose_events (schedule_id);
