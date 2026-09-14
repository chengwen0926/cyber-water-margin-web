'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { API_BASE_URL, dayApi, fetchApi } from '@/lib/api';
import type { DailyQueue, IncomingCallEvent } from '@/lib/api';

type GameContextValue = {
  queue: DailyQueue | null;
  currentDay: number;
  refetchQueue: () => void;
  advanceDay: () => Promise<void>;
  advancing: boolean;
  incomingCall: IncomingCallEvent | null;
  clearIncomingCall: () => void;
  dataVersion: number;
  notifyDataChanged: () => void;
  dayComplete: boolean;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<DailyQueue | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallEvent | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const hasAutoStarted = useRef(false);

  const notifyDataChanged = useCallback(() => setDataVersion((v) => v + 1), []);

  const advanceDay = useCallback(async () => {
    setAdvancing(true);
    try {
      const result = await dayApi.advanceDay();
      setQueue(result.queue);
      notifyDataChanged();
    } finally {
      setAdvancing(false);
    }
  }, [notifyDataChanged]);

  const refetchQueue = useCallback(() => {
    dayApi
      .getTodayQueue()
      .then((q) => {
        setQueue(q);
        // First time the desktop loads there's no queue yet — kick off day 1
        // automatically since there's no manual "进入下一天" control anymore.
        if (q.entries.length === 0 && !hasAutoStarted.current) {
          hasAutoStarted.current = true;
          advanceDay();
        }
      })
      .catch(() => setQueue(null));
    notifyDataChanged();
  }, [notifyDataChanged, advanceDay]);

  useEffect(() => {
    refetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = new EventSource(`${API_BASE_URL}/api/events`);
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as IncomingCallEvent;
        if (data.event === 'incoming_call') {
          setIncomingCall(data);
        }
      } catch {
        // ignore malformed events
      }
    };
    return () => source.close();
  }, []);

  const clearIncomingCall = useCallback(() => {
    const call = incomingCall;
    if (!call?.revision) { setIncomingCall(null); return; }
    void fetchApi('/api/events/call/ack', {method:'POST', body:JSON.stringify({revision:call.revision})})
      .then(() => setIncomingCall(current => current?.revision === call.revision ? null : current))
      .catch(() => { /* Keep the invitation available so the player can retry. */ });
  }, [incomingCall]);

  const dayComplete =
    queue !== null &&
    queue.entries.length > 0 &&
    queue.entries.every((entry) => entry.arrival_state === 'done');

  return (
    <GameContext.Provider
      value={{
        queue,
        currentDay: queue?.day ?? 1,
        refetchQueue,
        advanceDay,
        advancing,
        incomingCall,
        clearIncomingCall,
        dataVersion,
        notifyDataChanged,
        dayComplete,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
