import { fetchApi } from './client';
import type { DailySchedule } from './types';

export function getTodaySchedule(): Promise<DailySchedule> {
  return fetchApi<DailySchedule>('/api/schedule/today');
}
