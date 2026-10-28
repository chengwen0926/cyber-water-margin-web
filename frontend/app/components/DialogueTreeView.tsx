'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChatContact, ChatSession } from '@/lib/api';
import { BossPortrait } from './BossPortrait';
import { DialogueText } from './DialogueText';
import type { DialoguePlayback } from '@/lib/useDialoguePlayback';

export function ChatAvatar({ contact }: { contact: ChatContact }) {
  const [failed, setFailed] = useState(false);
  return <span className={`messenger-avatar ${contact.kind === 'boss' ? 'messenger-avatar--boss' : ''}`}>
    {contact.kind === 'boss' ? <><span className="messenger-avatar-initial">领</span><BossPortrait /></> : contact.avatar && !failed ? <img src={contact.avatar} alt="" onError={() => setFailed(true)} /> : contact.name.slice(0, 1)}
  </span>;
}

export function DialogueTreeView({ session, contact, pendingText, busy, playback, onAdvance, onSendText, children }: {
  session: ChatSession;
  contact: ChatContact;
  pendingText: string | null;
  busy: boolean;
  playback: DialoguePlayback;
  onAdvance: (optionId: string) => void;
  onSendText?: (text: string) => Promise<boolean>;
  children?: ReactNode;
}) {
  const history = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const submitting = useRef(false);
  const submitText = async () => {
    if (!onSendText || !text.trim() || busy || playback.playing || submitting.current) return;
    submitting.current = true;
    try { if (await onSendText(text.trim())) setText(''); }
    finally { submitting.current = false; requestAnimationFrame(() => input.current?.focus()); }
  };
  const ended = session.current_node.options.length === 0;
  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [session.contact_id, session.messages.length, pendingText, playback.count]);

  return <div className="messenger-dialogue">
    <div className="messenger-history" ref={history} role="log" aria-label="双方聊天记录" aria-relevant="additions" aria-live={playback.playing ? 'off' : 'polite'} aria-busy={playback.playing}>
      <div className="messenger-history-start">与 {contact.name} 的聊天</div>
      {session.messages.map((message, index) => <div key={index} className={`messenger-message ${message.speaker === 'player' ? 'messenger-message--self' : ''}`}>
        {message.speaker === 'player' ? <span className="messenger-avatar messenger-avatar--self">我</span> : <ChatAvatar key={contact.id} contact={contact} />}
        <div><small>{message.speaker === 'player' ? '我' : contact.name}</small><p><DialogueText message={message} count={index === session.messages.length - 1 ? playback.count : undefined} playing={index === session.messages.length - 1 && playback.playing} /></p></div>
      </div>)}
      {pendingText && <div className="messenger-message messenger-message--self messenger-message--pending"><span className="messenger-avatar messenger-avatar--self">我</span><div><small>发送中…</small><p>{pendingText}</p></div></div>}
    </div>
    <form className="messenger-composer" onSubmit={event => { event.preventDefault(); if (onSendText) void submitText(); }}>
      {children}
      <div className="messenger-composer-label">{playback.playing ? '数据流接收中…' : ended ? '本次对话已结束' : '选择回复'}<span>{busy ? '正在发送…' : playback.playing ? '正在接收台词' : ended ? '聊天记录已保存' : '点击选项直接继续'}</span></div>
      {playback.playing && <button type="button" className="dialogue-reveal" onClick={playback.complete}>显示全部</button>}
      <div className="messenger-options" aria-label="当前可选回答">{session.current_node.options.map(option => <button type="button" key={`${session.current_node.node_id}:${option.option_id}`} disabled={busy || playback.playing} onClick={() => onAdvance(option.option_id)}>{option.text}</button>)}</div>
      {onSendText && <><textarea ref={input} className="meeting-message-input" aria-label={`发送给${contact.name}的消息`} placeholder="输入消息，与对方交流…" value={text} maxLength={1000} disabled={busy || playback.playing}
        onChange={e => setText(e.target.value)} onCompositionStart={() => {composing.current=true;}} onCompositionEnd={() => {composing.current=false;}}
        onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composing.current && e.keyCode !== 229) {e.preventDefault();void submitText();}}} />
        <div className="messenger-send-row"><span>{busy ? '正在发送…' : 'Enter 发送 · Shift+Enter 换行'}</span><button type="submit" disabled={!text.trim() || busy || playback.playing}>发送</button></div></>}
    </form>
  </div>;
}
