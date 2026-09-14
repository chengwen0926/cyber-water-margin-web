'use client';

import { useEffect, useRef } from 'react';
import type { IncomingCallEvent } from '@/lib/api';

type Props = {
  call: IncomingCallEvent;
  onAnswer: () => void;
  onDecline: () => void;
};

export function IncomingCallModal({ call, onAnswer, onDecline }: Props) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelectorAll<HTMLButtonElement>('button')[1]?.focus();
    return () => previous?.focus();
  }, []);
  const name = call.caller_name ?? '领导';
  return (
    <div className="incoming-call-backdrop" role="presentation">
      <section ref={dialog} onKeyDown={event => {
        if (event.key === 'Tab') {
          event.preventDefault();
          const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
          if (buttons) buttons[document.activeElement === buttons[0] ? 1 : 0]?.focus();
        }
      }} className="incoming-call-modal" role="dialog" aria-modal="true" aria-labelledby="incoming-call-title">
        <div className="incoming-call-titlebar"><span>视频来电</span><span className="incoming-call-signal">LOCALNET</span></div>
        <div className="incoming-call-body">
          <div className="incoming-call-avatar" aria-hidden="true">{name.slice(0, 1)}</div>
          <div className="incoming-call-copy">
            <span className="incoming-call-label">视频来电</span>
            <h2 id="incoming-call-title">{name}</h2>
            <p>{name}邀请你进行视频面谈</p>
            <small>接听后进入会议窗口</small>
          </div>
        </div>
        <div className="incoming-call-actions">
          <button type="button" className="incoming-call-decline" onClick={onDecline}>拒绝</button>
          <button type="button" className="incoming-call-answer" onClick={onAnswer}>接听</button>
        </div>
      </section>
    </div>
  );
}
