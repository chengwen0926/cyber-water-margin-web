'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BossExpression, ChatSession, DialogueBeat } from './api';

export function useDialoguePlayback(session: ChatSession | null) {
  const message = session?.messages.at(-1);
  const text = message?.text ?? '';
  // Serialize cues so background read-receipt refreshes cannot restart playback.
  const cues = JSON.stringify(message?.beats ?? []);
  const key = JSON.stringify([session?.contact_id, session?.script_id, session?.current_node.node_id, session?.messages.length, text, cues]);
  const timeline = useMemo(() => {
    const beats: DialogueBeat[] = JSON.parse(cues);
    const segments = beats.length ? beats : [{ text, expression: 'smile' as BossExpression, char_ms: 35, pause_after_ms: 0, emphasis: [] }];
    let time = 0;
    const characters: { at: number; expression: BossExpression }[] = [];
    for (const beat of segments) {
      for (const char of Array.from(beat.text)) {
        time += beat.char_ms;
        characters.push({ at: time, expression: beat.expression });
        if ('。！？；'.includes(char)) time += 260;
        else if ('，、'.includes(char)) time += 100;
      }
      time += beat.pause_after_ms;
    }
    return { characters, firstExpression: segments[0].expression };
  }, [text, cues]);
  const [progress, setProgress] = useState({ key: '', count: 0 });
  const [skippedKey, setSkippedKey] = useState('');
  const total = timeline.characters.length;
  const count = skippedKey === key || message?.speaker === 'player' ? total : progress.key === key ? progress.count : 0;
  const playing = count < total;

  useEffect(() => {
    if (!total || skippedKey === key || message?.speaker === 'player') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reveal = () => setProgress({ key, count: total });
    let timer: number | undefined;
    const onPreferenceChange = () => { if (preference.matches) { window.clearTimeout(timer); reveal(); } };
    if (preference.matches) { reveal(); return; }
    preference.addEventListener('change', onPreferenceChange);
    const started = performance.now();
    let cursor = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      while (cursor < total && timeline.characters[cursor].at <= elapsed) cursor++;
      setProgress({ key, count: cursor });
      if (cursor < total) timer = window.setTimeout(tick, Math.max(1, timeline.characters[cursor].at - elapsed));
    };
    timer = window.setTimeout(tick, timeline.characters[0].at);
    return () => { window.clearTimeout(timer); preference.removeEventListener('change', onPreferenceChange); };
  }, [key, timeline, total, skippedKey, message?.speaker]);

  return {
    count, playing,
    expression: count > 0 ? timeline.characters[count - 1].expression : timeline.firstExpression,
    complete: () => setSkippedKey(key),
  };
}

export type DialoguePlayback = ReturnType<typeof useDialoguePlayback>;
