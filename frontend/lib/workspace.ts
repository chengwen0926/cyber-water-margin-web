import { fetchApi, ApiError } from './api';
export type FileSource = { kind: 'resume' | 'medical' | 'chat' | 'history'; id: string };
export type FileDocument = { source: FileSource; title: string; case_id: string | null; name?: string; contact: string | null; fields: {key: string; label: string; value: string}[]; body: string };
export type DesktopItem = { id: string; kind: 'file' | 'folder'; name: string; parent_id: string | null; deleted: boolean; source: FileSource | null };
export type DesktopSettings = { brightness: number; icon_size: number; motion: boolean };
export type DesktopState = { items: DesktopItem[]; settings: DesktopSettings };
export type Assessment = { case_id: string; unknown: number; conflicts: number; verified: number; summary: string; evidence: FileDocument[]; points: { key: string; label: string; declared: string; verified: string | null; status: 'unknown' | 'verified' | 'conflict' }[] };
export type LibraryRecord = {id: string; kind: string; title: string; date: string; body: string};
export const workspaceApi = {
  state: () => fetchApi<DesktopState>('/api/workspace'),
  document: (source: FileSource) => fetchApi<FileDocument>('/api/workspace/document', {method: 'POST', body: JSON.stringify(source)}),
  item: (body: {action: string; item_id?: string; parent_id?: string | null; name?: string; source?: FileSource}) => fetchApi<DesktopState>('/api/workspace/items', {method: 'POST', body: JSON.stringify(body)}),
  settings: (settings: DesktopSettings) => fetchApi('/api/workspace/settings', {method: 'POST', body: JSON.stringify(settings)}),
  import: (source: FileSource, case_id?: string) => fetchApi<Assessment>('/api/workspace/import', {method: 'POST', body: JSON.stringify({source, case_id})}),
  assessment: (id: string) => fetchApi<Assessment>(`/api/workspace/assessment/${encodeURIComponent(id)}`),
  library: () => fetchApi<LibraryRecord[]>('/api/workspace/library'),
  friend: (contact: string) => fetchApi<{case_id: string; name: string}>('/api/workspace/friends', {method: 'POST', body: JSON.stringify({contact})}),
};
export const FILE_MIME = 'application/x-localnet-file';
export function errorText(error: unknown) {
  if (error instanceof TypeError) return '无法连接游戏服务，请确认后端已启动后重新连接。';
  if (error instanceof ApiError && error.status >= 500) return '游戏服务暂时异常，请稍后重新连接。';
  const detail = (error as {body?: {detail?: unknown}})?.body?.detail;
  return typeof detail === 'string' ? detail : '操作失败，请重试';
}
