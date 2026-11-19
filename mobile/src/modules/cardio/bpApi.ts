import { request } from '../../api/client';
import type { BpLevel, BpValues, Moment, Slot } from './bp';

export interface BpMeasurementDto extends BpValues {
  id: string;
  dateMesure: string;
  niveau: BpLevel;
  serieId?: string | null;
  jour?: number | null;
  moment?: Moment | null;
  rang?: number | null;
}

export interface BpSeriesDto {
  id: string;
  dateDebut: string;
  creeLe: string;
  mesures: BpMeasurementDto[];
  nombreMesures: number;
  complet: boolean;
  moyenneTas?: number | null;
  moyenneTad?: number | null;
  moyennePouls?: number | null;
  moyenneAuDessusDuSeuil: boolean;
  avertissement: string;
}

const base = (seniorId: string) => `/seniors/${seniorId}/bp`;

export const bpApi = {
  record: (seniorId: string, values: BpValues, slot?: Slot & { serieId: string }) =>
    request<BpMeasurementDto>('POST', `${base(seniorId)}/measurements`, { body: { ...values, ...slot } }),
  history: (seniorId: string) =>
    request<{ avertissement: string; mesures: BpMeasurementDto[] }>('GET', `${base(seniorId)}/measurements`),
  startSeries: (seniorId: string, dateDebut: string) =>
    request<BpSeriesDto>('POST', `${base(seniorId)}/series`, { body: { dateDebut } }),
  series: (seniorId: string) => request<{ avertissement: string; series: BpSeriesDto[] }>('GET', `${base(seniorId)}/series`),
};
