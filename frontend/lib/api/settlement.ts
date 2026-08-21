import { fetchApi } from './client';
import type { DayResult } from './types';

export function settleToday(): Promise<DayResult> {
  return fetchApi<DayResult>('/api/settlement/today', { method: 'POST' });
}

export function getSettlement(day: number): Promise<DayResult> {
  return fetchApi<DayResult>(`/api/settlement/${day}`);
}
