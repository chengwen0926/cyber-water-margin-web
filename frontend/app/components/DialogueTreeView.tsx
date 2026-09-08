'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatContact, ChatSession } from '@/lib/api';

function CallPortrait({ contact }: { contact: ChatContact }) {
  const [failed, setFailed] = useState(false);
  return <div className="call-portrait">
    {contact.avatar && !failed ? <img src={contact.avatar} alt={contact.name} onError={() => setFailed(true)} /> : <>
      <svg viewBox="0 0 160 120" aria-hidden="true"><circle cx="80" cy="40" r="24" /><path d="M24 120v-12c0-34 25-48 56-48s56 14 56 48v12Z" /></svg>
      <span className="call-placeholder-label">角色画面待接入</span>
    </>}
  </div>;
}

export function DialogueTreeView({ session, contact, pendingText, busy, onAdvance, children }: {
  session: ChatSession;
  contact: ChatContact;
  pendingText: string | null;
  busy: boolean;
  onAdvance: (optionId: string) => void;
  children?: ReactNode;
}) {
  const history = useRef<HTMLDivElement>(null);
  const ended = session.current_node.options.length === 0;
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [session.contact_id, session.messages.length, pendingText]);

  return <div className="video-dialogue">
    <section className="call-screen" aria-label={`${contact.name}的视频通话窗口`}>
      <div className="call-screen-heading"><span>视频面谈 · {contact.name}</span><small>{ended ? '本次对话已结束' : '面谈中'}</small></div>
      <CallPortrait key={contact.id + contact.avatar} contact={contact} />
      <div className="call-nameplate"><strong>{contact.name}</strong><span>{contact.kind === 'boss' ? '领导' : '候选人'}</span></div>
      <div className="call-self" aria-label="我方画面占位"><span>HR</span><small>我方画面</small></div>
    </section>
    <section className="call-transcript" aria-label="聊天记录">
      <div className="call-transcript-heading">聊天记录 <span>{session.messages.length} 条</span></div>
      <div className="call-message-list" ref={history} role="log" aria-label="双方聊天记录" aria-relevant="additions" aria-live="polite">
        {session.messages.map((message, index) => <div key={index} className={`call-message ${message.speaker === 'player' ? 'call-message--self' : ''}`}>
          <small>{message.speaker === 'player' ? '我' : contact.name}</small><p>{message.text}</p>
        </div>)}
        {pendingText && <div className="call-message call-message--self call-message--pending"><small>我 · 发送中…</small><p>{pendingText}</p></div>}
      </div>
    </section>
    <section className="call-replies" aria-label="当前可选回答">
      {children}
      <div className="call-replies-heading">{ended ? '本次面谈结束' : busy ? '正在发送回答…' : '选择你的回答'}</div>
      {ended ? <p className="call-ended">聊天记录已保存，可以切换联系人查看其他会话。</p> :
        <div className="call-reply-options">{session.current_node.options.map((option, index) =>
          <button type="button" key={option.option_id} className="call-reply" disabled={busy} onClick={() => onAdvance(option.option_id)}>
            <span aria-hidden="true">{index + 1}</span>{option.text}
          </button>)}</div>}
    </section>
  </div>;
}
