import { fetchApi } from './client';
import type { CaseJudgement } from './types';

export function submitVerdict(
  caseId: string,
  verdict: 'approved' | 'rejected',
): Promise<CaseJudgement> {
  return fetchApi<CaseJudgement>(`/api/review/${caseId}/verdict`, {
    method: 'POST',
    body: JSON.stringify({ verdict }),
  });
}
