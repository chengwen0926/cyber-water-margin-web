'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { BossExpression, ChatContact } from '@/lib/api';
import { ChatAvatar } from './DialogueTreeView';
import { BossPortrait } from './BossPortrait';
import { BossPerformance } from './BossPerformance';

export function MeetingView({ contact, expression, onHangUp, onChatVisibilityChange, children }: { contact: ChatContact; expression?: BossExpression; onHangUp: () => void; onChatVisibilityChange: (visible: boolean) => void; children: ReactNode }) {
  const [startedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { onChatVisibilityChange(true); }, [onChatVisibilityChange]);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return <div className="meeting-app meeting-app--retro">
    <section className="meeting-scene" aria-label={`${contact.name}的视频画面`}>
      <div className="meeting-scene-window" aria-hidden="true" />
      <div className="meeting-scene-console" aria-hidden="true"><i /><i /><i /></div>
      {contact.kind === 'boss' && expression ? <BossPerformance expression={expression} /> : <div className="meeting-scene-portrait">{contact.kind === 'boss' ? <BossPortrait full /> : <ChatAvatar key={contact.id} contact={contact} />}</div>}
      <div className="meeting-scene-caption"><span>{contact.name} · {contact.kind === 'boss' ? '领导' : '候选人'}</span><span className="meeting-duration" aria-label="通话时长">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span></div>
    </section>
    <section className="meeting-terminal" aria-label="视频谈话记录与回复">{children}</section>
    <footer className="meeting-status"><span><i aria-hidden="true" /> 视频谈话 · 已连接</span><button type="button" onClick={onHangUp}>结束通话</button></footer>
  </div>;
}
