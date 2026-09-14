'use client';

import { FileTile, useFiles } from './FileSystem';
import { workspaceApi } from '@/lib/workspace';
import { useEffect, useRef, useState } from 'react';

import { archiveApi, chatApi, directivesApi } from '@/lib/api';
import type { ArchiveSummary, ChatContact, ChatSession, SpecialDirective } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { MeetingView } from './MeetingView';
import { ChatAvatar, DialogueTreeView } from './DialogueTreeView';
import { ReadFilterTabs, type ReadFilter, ReadStatus, useReadReceipt, useReading } from './ReadingProvider';
import { useGame } from './GameProvider';

export function ChatApp({ isActive, meetingContactId, onVideoCall, onHangUp }: {
  isActive: boolean;
  meetingContactId?: string;
  onVideoCall?: (contactId: string) => void;
  onHangUp?: () => void;
}) {
  const files = useFiles();
  const [addingFriend, setAddingFriend] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const [meetingChatVisible, setMeetingChatVisible] = useState(true);
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { entries: reading, refresh: refreshReading } = useReading();
  const { dataVersion } = useGame();
  const { data: contacts, loading: contactsLoading, error: contactsError, refetch: refetchContacts } = useApi<ChatContact[]>(() => chatApi.listChatContacts(), [dataVersion]);
  const { data: archiveSummaries } = useApi<ArchiveSummary[]>(() => archiveApi.listArchive(), [dataVersion]);
  const { data: activeDirectives, refetch: refetchDirectives } = useApi<SpecialDirective[]>(
    () => directivesApi.getActiveDirectives(),
    [],
  );

  const [selectedContactId, setSelectedContactId] = useState<string | null>(meetingContactId ?? null);
  const [loaded, setLoaded] = useState<{ version: string; session: ChatSession } | null>(null);
  const [pending, setPending] = useState<{ contactId: string; scriptId: string; text: string } | null>(null);
  const sending = useRef(false);
  const [reload, setReload] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const list = contacts ?? [];
  const filteredList = list.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()) && (readFilter === 'all' ||
    reading.chat[item.id]?.is_read === (readFilter === 'read')));

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
    isActive && (!meetingContactId || meetingChatVisible) && currentNode != null && currentNode.node_id === receipt?.node_id,
    loaded?.version ?? '');

  useEffect(() => {
    if (isActive) { refreshReading(); refetchDirectives(); }
  }, [isActive, refreshReading, refetchDirectives]);

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

  const handleSendText = async (text: string): Promise<boolean> => {
    if (!session || !loaded || sending.current) return false;
    const contactId = session.contact_id;
    sending.current = true;
    setToast(null);
    setPending({contactId,scriptId:session.script_id,text});
    try {
      const result = await chatApi.sendChatMessage(contactId, session.script_id, text, session.current_node.node_id, session.messages.length);
      refreshReading();
      if (selectionRef.current === contactId) {
        setLoaded({...loaded,session:result});
        if (result.current_node.node_id !== session.current_node.node_id) {
          if (result.current_node.reveals_clue) setToast(`发现线索：${result.current_node.reveals_clue}`);
          if (result.current_node.reveals_directive) { setToast(`收到密令：${result.current_node.reveals_directive}`); refetchDirectives(); }
        }
      }
      return true;
    } catch {
      refreshReading(); setReload(v => v + 1);
      if (selectionRef.current === contactId) setToast('发送未确认，已保留草稿；请核对同步后的聊天记录再重试。');
      return false;
    } finally { sending.current = false; setPending(null); }
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

  const dialogue = session && selected ? (
    <DialogueTreeView key={`${session.contact_id}:${session.script_id}`} onSendText={meetingContactId ? handleSendText : undefined} session={session} contact={selected} pendingText={pendingText} busy={pending !== null} onAdvance={handleAdvance}>
      {selected.kind === 'npc' && session.messages.some(m => m.speaker === 'player') && <div className="chat-evidence-file"><FileTile name="对话记录 · 拖入档案" source={{kind:'chat',id:selected.id}} /></div>}
      {toast && <div className="messenger-notice" role="status">{toast}</div>}
      {selected.kind === 'npc' && activeDirectives && activeDirectives.length > 0 && <div className="messenger-notice">可执行密令：{activeDirectives.map(directive => <button type="button" key={directive.directive_id} onClick={() => handleExecuteDirective(directive.directive_id)}>{directive.action.action_type}</button>)}</div>}
    </DialogueTreeView>
  ) : <div className="messenger-empty"><span aria-hidden="true">▤</span><h2>{selected ? '正在加载聊天…' : '聊天'}</h2><p>{toast ?? (contactsError ? '联系人加载失败' : selected || meetingContactId ? '正在同步聊天记录，请稍候…' : '选择联系人，开始聊天或视频面谈')}</p>
    {(selected || !!contactsError) && <button type="button" onClick={() => { refetchContacts(); refreshReading(); setReload(value => value + 1); }}>重新加载</button>}
  </div>;

  if (meetingContactId && onHangUp) return selected ? <MeetingView contact={selected} onHangUp={onHangUp} onChatVisibilityChange={setMeetingChatVisible}>{dialogue}</MeetingView> : <div className="meeting-loading">{dialogue}<button type="button" onClick={onHangUp}>取消通话</button></div>;

  return <div className={`messenger-app ${selected ? 'messenger-app--selected' : ''}`}>
    <aside className="messenger-rail" aria-label="聊天导航"><span className="messenger-avatar messenger-avatar--self">我</span><span className="messenger-rail-active" title="聊天" aria-label="聊天">▤</span><span className="messenger-rail-bottom">LOCAL<br />NET</span></aside>
    <nav className="messenger-directory" aria-label="聊天联系人目录">
      <div className="messenger-search"><button type="button" className="add-friend-button" onClick={() => setAddingFriend(!addingFriend)}>＋ 添加好友</button><input type="search" aria-label="搜索联系人" placeholder="搜索联系人" value={search} onChange={event => setSearch(event.target.value)} /></div>
      {addingFriend && <form className="add-friend-form" onSubmit={async e => {e.preventDefault();const result = await files.run('正在查找联系人…', () => workspaceApi.friend(contactInput));if(result){refetchContacts();setAddingFriend(false);setSelectedContactId(result.case_id);}}}><label>简历上的联系方式<input value={contactInput} placeholder="候选人工号@localnet" onChange={e => setContactInput(e.target.value)} /></label><button disabled={!contactInput.trim() || !!files.busy}>添加</button></form>}
      <ReadFilterTabs value={readFilter} onChange={value => { setReadFilter(value); setSelectedContactId(null); setLoaded(null); setToast(null); }} />
      <div className="messenger-contacts">
        {filteredList.map(contact => <button type="button" key={contact.id} className={`messenger-contact ${selected?.id === contact.id ? 'is-selected' : ''}`} aria-current={selected?.id === contact.id ? 'true' : undefined} onClick={() => openContact(contact)}>
          <ChatAvatar key={contact.id} contact={contact} /><span className="messenger-contact-copy"><strong>{contact.name}</strong><small>{contact.kind === 'boss' ? '领导 · 工作沟通' : '候选人 · 入职面谈'}</small></span><ReadStatus channel="chat" id={contact.id} />
        </button>)}
        {contactsError ? <div className="messenger-list-empty"><p>联系人加载失败</p><button type="button" onClick={refetchContacts}>重试</button></div> : filteredList.length === 0 && <p className="messenger-list-empty">{contactsLoading ? '正在加载联系人…' : '暂无符合条件的会话'}</p>}
      </div>
    </nav>
    <section className="messenger-conversation" aria-label="聊天内容">
      {selected && <header className="messenger-header"><button type="button" className="messenger-back" onClick={() => setSelectedContactId(null)} aria-label="返回联系人">‹</button><div><strong>{selected.name}</strong><small>{selected.kind === 'boss' ? '领导' : '候选人'}</small></div><button type="button" className="messenger-video-button" disabled={!session || pending !== null} onClick={() => onVideoCall?.(selected.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="13" height="12" rx="2" /><path d="m15 10 7-4v12l-7-4Z" /></svg>视频聊天</button></header>}
      {dialogue}
    </section>
  </div>;
}
