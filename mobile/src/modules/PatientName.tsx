/**
 * Nom du patient pour les PDF des modules cliniques : champ facultatif, mémorisé sur le téléphone et
 * partagé par les modules cliniques. Laissé vide, les rapports portent « Patient » (ou « المريض » en arabe).
 * Ne bloque jamais l'utilisation.
 */
import { useEffect, useState } from 'react';

import { useLanguage, type Dictionary } from '../i18n';
import { Card, Field } from '../theme';
import { readJson, writeJson } from './storage';

export const PATIENT_NAME_KEY = 'neurocare.modules.patientName';

export function displayName(name: string, t: Dictionary): string {
  return name.trim() || t.shared.defaultPatient;
}

export function usePatientName(): [string, (name: string) => void] {
  const [name, setName] = useState('');

  useEffect(() => {
    let active = true;
    void readJson(PATIENT_NAME_KEY, '').then((saved) => {
      if (active) setName((current) => current || saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const update = (value: string) => {
    setName(value);
    void writeJson(PATIENT_NAME_KEY, value.trim()).catch(() => undefined);
  };
  return [name, update];
}

export function PatientNameField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const { t } = useLanguage();
  return (
    <Card>
      <Field
        label={t.shared.patientNameLabel}
        value={value}
        onChangeText={onChange}
        placeholder={t.shared.defaultPatient}
        autoCapitalize="words"
        maxLength={80}
      />
    </Card>
  );
}
