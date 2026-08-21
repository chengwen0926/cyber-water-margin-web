'use client';

import { useState } from 'react';

import { emailApi } from '@/lib/api';
import type { Email } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useGame } from './GameProvider';

export function EmailApp() {
  const { refetchQueue, dataVersion } = useGame();
  const { data: emails, loading, refetch } = useApi<Email[]>(() => emailApi.listEmails(), [dataVersion]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const list = emails ?? [];
  const selected = list.find((item) => item.email_id === selectedId) ?? list[0] ?? null;

  const handleDownload = async (emailId: string, attachmentId: string) => {
    await emailApi.downloadAttachment(emailId, attachmentId);
    setDownloaded((prev) => new Set(prev).add(attachmentId));
    refetchQueue();
  };

  return (
    <div className="mail-app">
      <aside className="mail-sidebar">
        <div className="mail-account">
          <span>
            <strong>Email</strong>
            <small>{loading ? '加载中...' : `Connected · ${list.length} 封`}</small>
          </span>
        </div>
        <button className="is-active">收件箱</button>
      </aside>
      <section className="mail-main">
        <div className="mail-actions">
          <button onClick={() => refetch()}>刷新</button>
        </div>
        <div className="mail-workspace">
          <div className="mail-list">
            {list.map((item) => (
              <button
                key={item.email_id}
                className={selected?.email_id === item.email_id ? 'is-selected' : ''}
                onClick={() => setSelectedId(item.email_id)}
              >
                <span className="unread-dot is-unread" />
                <strong>{item.sender}</strong>
                <span>{item.subject}</span>
                <time>第{item.day}天</time>
              </button>
            ))}
          </div>
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
                    {selected.attachments.map((attachment) => {
                      const isDownloaded = downloaded.has(attachment.attachment_id);
                      return (
                        <div
                          key={attachment.attachment_id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                        >
                          <span>{attachment.filename}</span>
                          <button
                            className="default-button"
                            disabled={isDownloaded}
                            onClick={() => handleDownload(selected.email_id, attachment.attachment_id)}
                          >
                            {isDownloaded ? '已下载' : '下载'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p>暂无邮件</p>
            )}
          </article>
        </div>
        <div className="app-statusbar">
          <span>{list.length} messages</span>
          <span>Last checked just now</span>
        </div>
      </section>
    </div>
  );
}
