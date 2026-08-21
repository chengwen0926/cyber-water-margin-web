import { fetchApi } from './client';
import type { ArchiveDetail, ArchiveSummary, Clue } from './types';

export function listArchive(): Promise<ArchiveSummary[]> {
  return fetchApi<ArchiveSummary[]>('/api/archive');
}

export function getArchive(caseId: string): Promise<ArchiveDetail> {
  return fetchApi<ArchiveDetail>(`/api/archive/${caseId}`);
}

export function autoFlagArchive(
  caseId: string,
): Promise<{ photo_is_anomalous: boolean; clue: Clue | null }> {
  return fetchApi(`/api/archive/${caseId}/auto-flag`, { method: 'POST' });
}

export function flagField(
  caseId: string,
  fieldKey: string,
): Promise<{ flagged_field_keys: string[] }> {
  return fetchApi(`/api/archive/${caseId}/flag`, {
    method: 'POST',
    body: JSON.stringify({ field_key: fieldKey }),
  });
}
