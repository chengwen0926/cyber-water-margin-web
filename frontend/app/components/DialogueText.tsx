import type { ChatMessage } from '@/lib/api';

/** Keep formatting on authored text; never interpret dialogue as HTML. */
export function DialogueText({ message, count, playing = false }: { message: ChatMessage; count?: number; playing?: boolean }) {
  let offset = 0;
  const beats = message.beats?.length ? message.beats : [{ text: message.text, emphasis: [] }];
  return <>
    {beats.map((beat, index) => {
      const chars = Array.from(beat.text);
      const start = offset;
      offset += chars.length;
      const visible = chars.slice(0, count === undefined ? chars.length : Math.max(0, count - start));
      // Mark full-text ranges before slicing so partially received bold words stay bold.
      const emphasized = new Set<number>();
      for (const word of beat.emphasis) {
        if (!word) continue;
        let at = beat.text.indexOf(word);
        while (at !== -1) {
          const from = Array.from(beat.text.slice(0, at)).length;
          for (let i = from; i < from + Array.from(word).length; i++) emphasized.add(i);
          at = beat.text.indexOf(word, at + word.length);
        }
      }
      return <span key={index}>{visible.map((char, i) => {
        const newest = playing && start + i === (count ?? 0) - 1;
        return emphasized.has(i)
          ? <strong key={i} className={newest ? 'dialogue-byte' : undefined}>{char}</strong>
          : <span key={i} className={newest ? 'dialogue-byte' : undefined}>{char}</span>;
      })}</span>;
    })}
    {playing && <span className="dialogue-cursor" aria-hidden="true">▌</span>}
  </>;
}
