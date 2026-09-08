'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { useGame } from './GameProvider';

export type ReadChannel = 'email' | 'archive' | 'medical' | 'chat';
export type ReadEntry = { version: string; is_read: boolean; script_id?: string; node_id?: string };
type ReadingState = Record<ReadChannel, Record<string, ReadEntry>>;
type ReadingContextValue = {
  entries: ReadingState;
  error: string | null;
  refresh: () => void;
  markRead: (channel: ReadChannel, id: string, version: string) => Promise<void>;
};
const ReadingContext = createContext<ReadingContextValue | null>(null);

export function ReadingProvider({ children }: { children: React.ReactNode }) {
  const { dataVersion, incomingCall } = useGame();
  const [entries, setEntries] = useState<ReadingState>({ email: {}, archive: {}, medical: {}, chat: {} });
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const pending = useRef(new Set<string>());

  const refresh = useCallback(() => {
    const ticket = ++request.current;
    fetchApi<ReadingState>('/api/reading').then((result) => {
      if (ticket !== request.current) return;
      setEntries(result);
      setError(null);
    }).catch(() => { if (ticket === request.current) setError('阅读状态加载失败'); });
  }, []);

  useEffect(() => {
    refresh();
    return () => { request.current++; };
  }, [dataVersion, incomingCall, refresh]);
  useEffect(() => {
    globalThis.addEventListener('focus', refresh);
    return () => globalThis.removeEventListener('focus', refresh);
  }, [refresh]);

  const markRead = useCallback(async (channel: ReadChannel, id: string, version: string) => {
    const key = `${channel}:${id}:${version}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    try {
      await fetchApi('/api/reading', { method: 'POST', body: JSON.stringify({ channel, item_id: id, version }) });
      // A late receipt must never mark a newer message as read.
      setEntries((current) => current[channel][id]?.version === version
        ? { ...current, [channel]: { ...current[channel], [id]: { ...current[channel][id], is_read: true } } }
        : current);
      setError(null);
      refresh();
    } catch {
      setError('阅读状态保存失败，请重新打开内容重试');
    } finally {
      pending.current.delete(key);
    }
  }, [refresh]);

  return <ReadingContext.Provider value={{ entries, error, refresh, markRead }}>{children}</ReadingContext.Provider>;
}

export function useReading() {
  const context = useContext(ReadingContext);
  if (!context) throw new Error('useReading must be used within ReadingProvider');
  return context;
}

/** Only acknowledge content that has rendered in the foreground window. */
export function useReadReceipt(channel: ReadChannel, id: string | null, visible: boolean, displayedVersion?: string) {
  const { entries, markRead } = useReading();
  const entry = id ? entries[channel][id] : undefined;
  const version = displayedVersion ?? entry?.version;
  useEffect(() => {
    if (visible && id && version && entry && !entry.is_read && entry.version === version) {
      void markRead(channel, id, version);
    }
  }, [channel, id, visible, version, entry?.version, entry?.is_read, markRead]);
}

export function ReadStatus({ channel, id }: { channel: ReadChannel; id: string }) {
  const { entries } = useReading();
  const entry = entries[channel][id];
  return <span className={`read-status ${entry && !entry.is_read ? 'read-status--unread' : ''}`}>
    <span className="read-status__dot" aria-hidden="true" />{entry ? entry.is_read ? '已读' : '未读' : '…'}
  </span>;
}

export type ReadFilter = 'all' | 'read' | 'unread';
export function ReadFilterTabs({ value, onChange }: { value: ReadFilter; onChange: (value: ReadFilter) => void }) {
  return <div className="read-filter-tabs" role="tablist" aria-label="阅读状态筛选">
    {([['all', '全部'], ['unread', '未读'], ['read', '已读']] as const).map(([key, label]) => (
      <button key={key} type="button" role="tab" aria-selected={value === key} className={value === key ? 'is-active' : ''} onClick={() => onChange(key)}>{label}</button>
    ))}
  </div>;
}
