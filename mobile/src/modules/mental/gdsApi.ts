import { request } from '../../api/client';
import type { GdsAnswers, GdsLevel } from './gds';

export interface GdsAssessmentDto {
  id: string;
  datePassation: string;
  reponses: GdsAnswers;
  scoreMiniGds: number;
  scoreGds15?: number | null;
  niveau: GdsLevel;
  avertissement: string;
}

export interface GdsHistoryDto {
  avertissement: string;
  passations: GdsAssessmentDto[];
}

const base = (seniorId: string) => `/seniors/${seniorId}/gds/assessments`;

export const gdsApi = {
  record: (seniorId: string, reponses: GdsAnswers) =>
    request<GdsAssessmentDto>('POST', base(seniorId), { body: { reponses } }),
  history: (seniorId: string) => request<GdsHistoryDto>('GET', base(seniorId)),
};
