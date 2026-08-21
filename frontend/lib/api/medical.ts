import { fetchApi } from './client';
import type { Clue, MedicalRecordView } from './types';

export function getMedical(npcId: string): Promise<MedicalRecordView> {
  return fetchApi<MedicalRecordView>(`/api/medical/${npcId}`);
}

export function compareMedical(
  npcId: string,
  caseId: string,
): Promise<{ mismatches: Clue[] }> {
  return fetchApi(`/api/medical/${npcId}/compare/${caseId}`, { method: 'POST' });
}
