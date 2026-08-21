'use client';

import { useEffect, useState } from 'react';

import { archiveApi, chatApi, directivesApi } from '@/lib/api';
import type { ArchiveSummary, ChatContact, ChatScript, DialogueNode, SpecialDirective } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { DialogueTreeView } from './DialogueTreeView';
import { useGame } from './GameProvider';

export function ChatApp() {
  const { incomingCall, clearIncomingCall, dataVersion } = useGame();
  const { data: contacts } = useApi<ChatContact[]>(() => chatApi.listChatContacts(), [dataVersion]);
  const { data: archiveSummaries } = useApi<ArchiveSummary[]>(() => archiveApi.listArchive(), [dataVersion]);
  const { data: activeDirectives, refetch: refetchDirectives } = useApi<SpecialDirective[]>(
    () => directivesApi.getActiveDirectives(),
    [],
  );

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [script, setScript] = useState<ChatScript | null>(null);
  const [currentNode, setCurrentNode] = useState<DialogueNode | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const list = contacts ?? [];
  const selected = list.find((c) => c.id === selectedContactId) ?? list[0] ?? null;

  const openContact = (contact: ChatContact) => {
    setSelectedContactId(contact.id);
    setToast(null);
    Promise.all([
      chatApi.getChatScript(contact.script_id),
      chatApi.getCurrentNode(contact.script_id),
    ]).then(([s, node]) => {
      setScript(s);
      setCurrentNode(node);
    });
  };

  useEffect(() => {
    if (list.length > 0 && !selectedContactId) {
      openContact(list[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  useEffect(() => {
    if (!incomingCall) return;
    const bossContact = list.find((c) => c.kind === 'boss');
    if (bossContact) {
      Promise.all([
        chatApi.getChatScript(incomingCall.script_id),
        chatApi.getCurrentNode(incomingCall.script_id),
      ]).then(([s, node]) => {
        setSelectedContactId('boss');
        setScript(s);
        setCurrentNode(node);
      });
    }
    clearIncomingCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall]);

  const handleAdvance = async (optionId: string | null) => {
    if (!script) return;
    const next = await chatApi.advanceChat(script.script_id, optionId);
    setCurrentNode(next);
    if (next.reveals_clue) setToast(`发现线索：${next.reveals_clue}`);
    if (next.reveals_directive) {
      setToast(`收到密令：${next.reveals_directive}`);
      refetchDirectives();
    }
  };

  const handleExecuteDirective = async (directiveId: string) => {
    if (!selected || selected.kind !== 'npc') return;
    const npcCase = archiveSummaries?.find((s) => s.case_id === selected.id);
    if (!npcCase) return;
    try {
      await directivesApi.executeDirective(directiveId, npcCase.case_id);
      setToast('密令执行成功');
      refetchDirectives();
    } catch {
      setToast('条件不满足，密令执行失败');
    }
  };

  return (
    <div className="chat-app">
      <aside className="chat-sidebar">
        <div className="chat-user">
          <span className="avatar avatar--self">YOU</span>
          <span>
            <strong>Local User</strong>
            <small>
              <span className="presence" /> Available
            </small>
          </span>
        </div>
        <div className="section-label">CONTACTS</div>
        {list.map((contact) => (
          <button
            key={contact.id}
            className={selected?.id === contact.id ? 'is-selected' : ''}
            onClick={() => openContact(contact)}
          >
            <span className="avatar">{contact.kind === 'boss' ? '领导' : contact.name.slice(0, 2)}</span>
            <span>
              <strong>{contact.name}</strong>
              <small>
                <span className="presence" /> Available
              </small>
            </span>
          </button>
        ))}
      </aside>
      <section className="conversation">
        <header>
          <span className="avatar">{selected ? (selected.kind === 'boss' ? '领导' : selected.name.slice(0, 2)) : '--'}</span>
          <span>
            <strong>{selected?.name ?? '未选择联系人'}</strong>
            <small>Direct connection • Encrypted</small>
          </span>
        </header>
        {script && currentNode ? (
          <DialogueTreeView script={script} currentNode={currentNode} onAdvance={handleAdvance} />
        ) : (
          <div className="message-list" />
        )}
        {toast && (
          <div className="directive-banner">{toast}</div>
        )}
        {selected?.kind === 'npc' && activeDirectives && activeDirectives.length > 0 && (
          <div className="directive-banner" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>可执行密令：</span>
            {activeDirectives.map((directive) => (
              <button
                key={directive.directive_id}
                className="default-button"
                onClick={() => handleExecuteDirective(directive.directive_id)}
              >
                {directive.action.action_type}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
