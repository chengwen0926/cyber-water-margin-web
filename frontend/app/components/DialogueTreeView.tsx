'use client';

import type { ChatScript, DialogueNode } from '@/lib/api';

export function DialogueTreeView({
  script,
  currentNode,
  onAdvance,
}: {
  script: ChatScript;
  currentNode: DialogueNode;
  onAdvance: (optionId: string | null) => void;
}) {
  return (
    <div className="message-list">
      <div className="message">
        <span>{currentNode.text}</span>
      </div>
      {currentNode.options.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {currentNode.options.map((option) => (
            <button
              key={option.option_id}
              className="default-button"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => onAdvance(option.option_id)}
            >
              {option.text}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 10, color: '#777' }}>对话结束</div>
      )}
    </div>
  );
}
