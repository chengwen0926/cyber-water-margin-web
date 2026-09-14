'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatContact, ChatSession } from '@/lib/api';

export function ChatAvatar({ contact }: { contact: ChatContact }) {
  const [failed, setFailed] = useState(false);
  return <span className={`messenger-avatar ${contact.kind === 'boss' ? 'messenger-avatar--boss' : ''}`}>
    {contact.avatar && !failed ? <img src={contact.avatar} alt="" onError={() => setFailed(true)} /> : contact.name.slice(0, 1)}
  </span>;
}

export function DialogueTreeView({ session, contact, pendingText, busy, onAdvance, onSendText, children }: {
  session: ChatSession;
  contact: ChatContact;
  pendingText: string | null;
  busy: boolean;
  onAdvance: (optionId: string) => void;
  onSendText?: (text: string) => Promise<boolean>;
  children?: ReactNode;
}) {
  const history = useRef<HTMLDivElement>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const submitting = useRef(false);
  const submitText = async () => {
    if (!onSendText || !text.trim() || busy || submitting.current) return;
    submitting.current = true;
    try { if (await onSendText(text.trim())) setText(''); }
    finally { submitting.current = false; requestAnimationFrame(() => input.current?.focus()); }
  };
  const ended = session.current_node.options.length === 0;
  const draft = session.current_node.options.find(option => option.option_id === optionId);
  useEffect(() => { setOptionId(null); }, [session.contact_id, session.script_id, session.current_node.node_id]);
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [session.contact_id, session.messages.length, pendingText]);

  return <div className="messenger-dialogue">
    <div className="messenger-history" ref={history} role="log" aria-label="双方聊天记录" aria-relevant="additions" aria-live="polite">
      <div className="messenger-history-start">与 {contact.name} 的聊天</div>
      {session.messages.map((message, index) => <div key={index} className={`messenger-message ${message.speaker === 'player' ? 'messenger-message--self' : ''}`}>
        {message.speaker === 'player' ? <span className="messenger-avatar messenger-avatar--self">我</span> : <ChatAvatar key={contact.id} contact={contact} />}
        <div><small>{message.speaker === 'player' ? '我' : contact.name}</small><p>{message.text}</p></div>
      </div>)}
      {pendingText && <div className="messenger-message messenger-message--self messenger-message--pending"><span className="messenger-avatar messenger-avatar--self">我</span><div><small>发送中…</small><p>{pendingText}</p></div></div>}
    </div>
    <form className="messenger-composer" onSubmit={event => { event.preventDefault(); if (onSendText) { void submitText(); } else if (draft && !busy) onAdvance(draft.option_id); }}>
      {children}
      <div className="messenger-composer-label">{onSendText ? `发送给 ${contact.name}` : ended ? '本次对话已结束' : '选择回复'}<span>{onSendText ? '快捷回复可填入输入框' : ended ? '聊天记录已保存' : '选择后点击发送'}</span></div>
      <div className="messenger-options" aria-label="当前可选回答">{session.current_node.options.map(option => <button type="button" key={option.option_id} aria-pressed={draft?.option_id === option.option_id} disabled={busy} onClick={() => {setOptionId(option.option_id); if (onSendText) setText(option.text);}}>{option.text}</button>)}</div>
      {onSendText && <><textarea ref={input} className="meeting-message-input" aria-label={`发送给${contact.name}的消息`} placeholder="输入消息，与对方交流…" value={text} maxLength={1000} disabled={busy}
        onChange={e => setText(e.target.value)} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}}
        onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composing.current && e.keyCode !== 229) {e.preventDefault();void submitText();}}} />
        <div className="messenger-send-row"><span>{busy ? '正在发送…' : 'Enter 发送 · Shift+Enter 换行'}</span><button type="submit" disabled={!text.trim() || busy}>发送</button></div></>}
      {!onSendText && !ended && <div className="messenger-send-row"><span>{busy ? '正在发送…' : draft ? draft.text : '请选择一条回复'}</span><button type="submit" disabled={!draft || busy}>发送</button></div>}
    </form>
  </div>;
}
