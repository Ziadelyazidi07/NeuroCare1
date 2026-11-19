import { request } from '../../api/client';
import type { FamilyHistory, FindriscAnswers, FindriscLevel, FindriscPoints, Sexe } from './findrisc';

export interface FindriscAssessmentDto {
  id: string;
  datePassation: string;
  age: number;
  sexe: Sexe;
  poidsKg: number;
  tailleCm: number;
  imc: number;
  tourTailleCm: number;
  activitePhysique: boolean;
  fruitsLegumesQuotidiens: boolean;
  medicamentsHypertension: boolean;
  glycemieEleveeAntecedent: boolean;
  antecedentsFamiliaux: FamilyHistory;
  points: FindriscPoints;
  scoreTotal: number;
  niveau: FindriscLevel;
  pourcentageA10Ans: number;
  avertissement: string;
}

export interface FindriscHistoryDto {
  avertissement: string;
  passations: FindriscAssessmentDto[];
}

const base = (seniorId: string) => `/seniors/${seniorId}/findrisc/assessments`;

export const findriscApi = {
  record: (seniorId: string, body: FindriscAnswers) => request<FindriscAssessmentDto>('POST', base(seniorId), { body }),
  history: (seniorId: string) => request<FindriscHistoryDto>('GET', base(seniorId)),
};
