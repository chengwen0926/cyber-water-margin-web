'use client';

import { useEffect, useRef, useState } from 'react';

import { archiveApi, chatApi, directivesApi } from '@/lib/api';
import type { ArchiveSummary, ChatContact, ChatSession, SpecialDirective } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { DialogueTreeView } from './DialogueTreeView';
import { ReadFilterTabs, type ReadFilter, ReadStatus, useReadReceipt, useReading } from './ReadingProvider';
import { useGame } from './GameProvider';

export function ChatApp({ isActive }: { isActive: boolean }) {
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { entries: reading, refresh: refreshReading } = useReading();
  const { incomingCall, clearIncomingCall, dataVersion } = useGame();
  const { data: contacts } = useApi<ChatContact[]>(() => chatApi.listChatContacts(), [dataVersion]);
  const { data: archiveSummaries } = useApi<ArchiveSummary[]>(() => archiveApi.listArchive(), [dataVersion]);
  const { data: activeDirectives, refetch: refetchDirectives } = useApi<SpecialDirective[]>(
    () => directivesApi.getActiveDirectives(),
    [],
  );

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ version: string; session: ChatSession } | null>(null);
  const [pending, setPending] = useState<{ contactId: string; scriptId: string; text: string } | null>(null);
  const sending = useRef(false);
  const [reload, setReload] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const list = contacts ?? [];
  const filteredList = list.filter((item) => readFilter === 'all' ||
    reading.chat[item.id]?.is_read === (readFilter === 'read'));

  const selected = list.find((c) => c.id === selectedContactId) ?? null;
  const selectedId = selected?.id ?? null;
  const receipt = selectedId ? reading.chat[selectedId] : undefined;
  const scriptId = receipt?.script_id ?? selected?.script_id;
  const version = receipt?.version;
  const session = loaded?.session.contact_id === selectedId && loaded?.session.script_id === scriptId ? loaded.session : null;
  const currentNode = session?.current_node;
  const pendingText = pending?.contactId === selectedId && pending?.scriptId === scriptId ? pending.text : null;
  const selectionRef = useRef(selectedId);
  selectionRef.current = selectedId;

  const openContact = (contact: ChatContact) => {
    setSelectedContactId(contact.id);
    setToast(null);
  };

  useEffect(() => {
    if (incomingCall && isActive && readFilter === 'all') setSelectedContactId('boss');
  }, [incomingCall, isActive, readFilter]);

  useEffect(() => {
    if (!selectedId || !scriptId || !version) return;
    let cancelled = false;
    chatApi.getChatSession(selectedId, scriptId)
      .then((session) => {
        if (cancelled) return;
        setLoaded({ version, session });
      }).catch(() => { if (!cancelled) setToast('消息加载失败，请点击重新加载'); });
    return () => { cancelled = true; };
  }, [selectedId, scriptId, version, reload]);

  useReadReceipt('chat', selectedId,
    isActive && currentNode != null && currentNode.node_id === receipt?.node_id,
    loaded?.version ?? '');

  useEffect(() => {
    if (isActive && selectedId === 'boss' && incomingCall && receipt?.is_read &&
        loaded?.version === receipt.version && session?.script_id === incomingCall.script_id) {
      clearIncomingCall();
    }
  }, [isActive, selectedId, incomingCall, receipt, loaded, session, clearIncomingCall]);

  const handleAdvance = async (optionId: string) => {
    if (!session || !loaded || sending.current) return;
    const option = session.current_node.options.find((item) => item.option_id === optionId);
    if (!option) return;
    const contactId = session.contact_id;
    sending.current = true;
    setToast(null);
    setPending({ contactId, scriptId: session.script_id, text: option.text });
    try {
      const result = await chatApi.advanceChatSession(contactId, session.script_id, optionId, session.current_node.node_id);
      refreshReading();
      if (selectionRef.current !== contactId) return;
      setLoaded({ ...loaded, session: result });
      const next = result.current_node;
      if (next.reveals_clue) setToast(`发现线索：${next.reveals_clue}`);
      if (next.reveals_directive) {
        setToast(`收到密令：${next.reveals_directive}`);
        refetchDirectives();
      }
    } catch {
      refreshReading();
      setReload((value) => value + 1);
      if (selectionRef.current === contactId) setToast('回复未确认，正在同步聊天记录；请查看记录后重试。');
    } finally {
      sending.current = false;
      setPending(null);
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
    <div className="workspace-layout chat-layout">
      <aside className="workspace-categories" aria-label="聊天分类">
        <div className="section-label">聊天分类</div>
        <ReadFilterTabs value={readFilter} onChange={(value) => { setReadFilter(value); setSelectedContactId(null); setLoaded(null); setToast(null); }} />
      </aside>
      <nav className="candidate-directory" aria-label="聊天联系人目录">
        <div className="candidate-directory-heading"><strong>联系人</strong><span>{filteredList.length} 位</span></div>
        <div className="candidate-directory-list">
          {filteredList.map((contact) => (
            <button
              key={contact.id}
              className={`candidate-item chat-contact ${selected?.id === contact.id ? 'is-selected' : ''}`}
              aria-current={selected?.id === contact.id ? 'true' : undefined}
              onClick={() => openContact(contact)}
            >
              <span className="avatar">{contact.kind === 'boss' ? '领导' : contact.name.slice(0, 2)}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>
                  {contact.kind === 'boss' ? '领导' : '候选人'}
                </small>
                <ReadStatus channel="chat" id={contact.id} />
              </span>
            </button>
          ))}
          {filteredList.length === 0 && <p className="filter-empty">暂无符合条件的会话</p>}
        </div>
      </nav>
      <section className="conversation" aria-label="聊天内容">
        {session && selected ? (
          <DialogueTreeView session={session} contact={selected} pendingText={pendingText} busy={pending !== null} onAdvance={handleAdvance}>
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
          </DialogueTreeView>
        ) : (
          <div className="call-empty"><span aria-hidden="true">▣</span><h2>{selected ? '正在载入通话…' : '视频面谈'}</h2><p>{toast ?? '从左侧选择一位联系人，查看通话与聊天记录。'}</p>
            {selected && <button className="default-button" onClick={() => { refreshReading(); setReload((value) => value + 1); }}>重新加载</button>}
          </div>
        )}
      </section>
    </div>
  );
}
