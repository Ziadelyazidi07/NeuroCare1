import { request } from '../../api/client';
import type { Spo2Level } from './spo2';

export interface Spo2ProfileDto {
  /** Absent tant que la question du profil respiratoire n'a pas été posée. */
  maladieRespiratoireChronique?: boolean | null;
  misAJourLe?: string | null;
}

export interface Spo2MeasurementDto {
  id: string;
  dateMesure: string;
  spo2: number;
  pouls: number;
  maladieRespiratoireChronique: boolean;
  niveau: Spo2Level;
}

export interface Spo2HistoryDto {
  avertissement: string;
  mesures: Spo2MeasurementDto[];
}

const base = (seniorId: string) => `/seniors/${seniorId}/spo2`;

export const spo2Api = {
  profile: (seniorId: string) => request<Spo2ProfileDto>('GET', `${base(seniorId)}/profile`),
  setProfile: (seniorId: string, maladieRespiratoireChronique: boolean) =>
    request<Spo2ProfileDto>('PUT', `${base(seniorId)}/profile`, { body: { maladieRespiratoireChronique } }),
  record: (seniorId: string, body: { spo2: number; pouls: number }) =>
    request<Spo2MeasurementDto>('POST', `${base(seniorId)}/measurements`, { body }),
  history: (seniorId: string) => request<Spo2HistoryDto>('GET', `${base(seniorId)}/measurements`),
};
