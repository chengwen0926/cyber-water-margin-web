import { fetchApi } from './client';
import type { DailyGenerationResult, DailyQueue } from './types';

export function advanceDay(): Promise<DailyGenerationResult> {
  return fetchApi<DailyGenerationResult>('/api/day/advance', { method: 'POST' });
}

export function getTodayQueue(): Promise<DailyQueue> {
  return fetchApi<DailyQueue>('/api/day/queue');
}
