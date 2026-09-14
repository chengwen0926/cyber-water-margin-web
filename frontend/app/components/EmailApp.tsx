'use client';

import { FileTile } from './FileSystem';
import { useState } from 'react';

import { emailApi } from '@/lib/api';
import type { Email } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ReadFilterTabs, type ReadFilter, ReadStatus, useReadReceipt, useReading } from './ReadingProvider';
import { useGame } from './GameProvider';

export function EmailApp({ isActive }: { isActive: boolean }) {
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { entries } = useReading();
  const { dataVersion } = useGame();
  const { data: emails, loading, refetch } = useApi<Email[]>(() => emailApi.listEmails(), [dataVersion]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = emails ?? [];
  const filteredList = list.filter((item) => readFilter === 'all' ||
    entries.email[item.email_id]?.is_read === (readFilter === 'read'));

  const selected = list.find((item) => item.email_id === selectedId) ?? null;

  useReadReceipt('email', selected?.email_id ?? null, isActive && selected !== null);

  return (
    <div className="workspace-layout mail-layout">
      <aside className="workspace-categories" aria-label="邮件分类">
        <div className="section-label">邮件分类</div>
        <ReadFilterTabs value={readFilter} onChange={(value) => { setReadFilter(value); setSelectedId(null); }} />
      </aside>
      <nav className="candidate-directory" aria-label="邮件目录">
        <div className="candidate-directory-heading"><strong>收件箱</strong><span>{filteredList.length} 封</span></div>
        <div className="directory-tools"><button className="default-button" onClick={refetch}>刷新邮件</button></div>
        <div className="candidate-directory-list">
          {filteredList.map((item) => (
            <button key={item.email_id} type="button"
              className={`candidate-item ${selected?.email_id === item.email_id ? 'is-selected' : ''}`}
              aria-current={selected?.email_id === item.email_id ? 'true' : undefined}
              onClick={() => setSelectedId(item.email_id)}>
              <strong>{item.subject}</strong>
              <small>{item.sender} · 第{item.day}天</small>
              <ReadStatus channel="email" id={item.email_id} />
            </button>
          ))}
          {loading && <p className="filter-empty">加载邮件中…</p>}
          {!loading && filteredList.length === 0 && <p className="filter-empty">暂无符合条件的邮件</p>}
        </div>
      </nav>
      <section className="workspace-detail mail-detail" aria-label="邮件内容">
        <div className="workspace-detail-heading"><strong>{selected?.subject ?? '邮件内容'}</strong></div>
        <article className="mail-reader">
            {selected ? (
              <>
                <div className="mail-meta">
                  <strong>{selected.subject}</strong>
                  <span>From: {selected.sender}</span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</p>
                {selected.attachments.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 500 }}>附件：</p>
                    <p className="attachment-instructions">双击查看原件 · 拖到桌面保存 · 拖到档案建立档案</p>
                    <div className="attachment-file-grid">{selected.attachments.map(attachment => <FileTile key={attachment.attachment_id} name={attachment.filename} source={{kind:'resume',id:attachment.case_id}} />)}</div>
                  </div>
                )}
              </>
            ) : (
              <p>请从列表中选择一封邮件</p>
            )}
        </article>
        <div className="app-statusbar"><span>{list.length} 封邮件 · {list.filter((item) => entries.email[item.email_id]?.is_read === false).length} 封未读</span></div>
      </section>
    </div>
  );
}
