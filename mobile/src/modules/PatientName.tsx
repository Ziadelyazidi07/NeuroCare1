/**
 * Nom du patient pour les PDF des modules cliniques : champ facultatif, mémorisé sur le téléphone et
 * partagé par les modules cliniques. Laissé vide, les rapports portent « Patient ». Ne bloque jamais l'utilisation.
 */
import { useEffect, useState } from 'react';

import { Card, Field } from '../ui/components';
import { readJson, writeJson } from './storage';

export const PATIENT_NAME_KEY = 'neurocare.modules.patientName';
export const DEFAULT_PATIENT = 'Patient';

export function displayName(name: string): string {
  return name.trim() || DEFAULT_PATIENT;
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
  return (
    <Card>
      <Field
        label="Nom et prénom du patient (facultatif, pour les rapports PDF)"
        value={value}
        onChangeText={onChange}
        placeholder={DEFAULT_PATIENT}
        autoCapitalize="words"
        maxLength={80}
      />
    </Card>
  );
}
