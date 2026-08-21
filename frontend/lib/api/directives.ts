import { fetchApi } from './client';
import type { SpecialDirective } from './types';

export function getActiveDirectives(): Promise<SpecialDirective[]> {
  return fetchApi<SpecialDirective[]>('/api/directives/active');
}

export function executeDirective(
  directiveId: string,
  caseId: string,
): Promise<{ executed: boolean; action_type: string }> {
  return fetchApi(`/api/directives/${directiveId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ case_id: caseId }),
  });
}
