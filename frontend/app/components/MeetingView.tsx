'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { ChatContact } from '@/lib/api';
import { ChatAvatar } from './DialogueTreeView';

export function MeetingView({ contact, onHangUp, onChatVisibilityChange, children }: { contact: ChatContact; onHangUp: () => void; onChatVisibilityChange: (visible: boolean) => void; children: ReactNode }) {
  const [startedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [chat, setChat] = useState(true);
  const [grid, setGrid] = useState(false);
  useEffect(() => { onChatVisibilityChange(chat); }, [chat, onChatVisibilityChange]);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return <div className="meeting-app">
    <header className="meeting-topbar"><strong>视频面谈 · {contact.name}</strong><span className="meeting-duration">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span><button type="button" onClick={() => setGrid(!grid)}>{grid ? '切换演讲者视图' : '切换宫格视图'}</button></header>
    <div className={`meeting-body ${chat ? '' : 'meeting-body--no-chat'}`}>
      <section className={`meeting-stage ${grid ? 'meeting-stage--grid' : ''}`} aria-label="参会者画面">
        <div className="meeting-participant meeting-participant--remote"><div className="meeting-identity"><ChatAvatar key={contact.id} contact={contact} /><h2>{contact.name}</h2><p>角色视频暂未提供</p></div><span className="meeting-nameplate">{contact.name} · {contact.kind === 'boss' ? '领导' : '候选人'}</span></div>
        <div className="meeting-participant meeting-participant--self"><div className="meeting-identity"><span className="meeting-self-avatar">{camera ? 'HR' : '▣'}</span><p>{camera ? '我方虚拟画面' : '画面已关闭'}</p></div><span className="meeting-nameplate">我{muted ? ' · 已静音' : ''}</span></div>
      </section>
      <aside className="meeting-chat" aria-label="会议聊天" hidden={!chat}><header>聊天 <button type="button" aria-label="收起会议聊天" onClick={() => setChat(false)}>×</button></header>{children}</aside>
    </div>
    <footer className="meeting-controls"><button type="button" aria-pressed={muted} onClick={() => setMuted(!muted)}><span aria-hidden="true">{muted ? '♩' : '♪'}</span>{muted ? '解除静音' : '静音'}</button><button type="button" aria-pressed={camera} onClick={() => setCamera(!camera)}><span aria-hidden="true">▣</span>{camera ? '关闭画面' : '开启画面'}</button><span className="meeting-member-count">参会者（2）<small>游戏内虚拟面谈</small></span><button type="button" aria-pressed={chat} onClick={() => setChat(!chat)}><span aria-hidden="true">▤</span>聊天</button><button type="button" className="meeting-hangup" onClick={onHangUp}>结束通话</button></footer>
  </div>;
}
