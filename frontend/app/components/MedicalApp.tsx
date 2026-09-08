'use client';

import { useEffect, useState } from 'react';

import { archiveApi, medicalApi } from '@/lib/api';
import type { ArchiveSummary, Clue, MedicalRecordView } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ReadFilterTabs, type ReadFilter, ReadStatus, useReadReceipt, useReading } from './ReadingProvider';
import { useGame } from './GameProvider';

export function MedicalApp({ isActive }: { isActive: boolean }) {
  const { entries } = useReading();
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { dataVersion, notifyDataChanged } = useGame();
  const { data: summaries, loading } = useApi<ArchiveSummary[]>(
    () => archiveApi.listArchive(),
    [dataVersion],
  );
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [record, setRecord] = useState<MedicalRecordView | null>(null);
  const [mismatches, setMismatches] = useState<Clue[] | null>(null);

  const list = summaries ?? [];
  const filteredList = list.filter((item) => readFilter === 'all' ||
    entries.medical[item.npc_id]?.is_read === (readFilter === 'read'));

  const activeNpcId = selectedNpcId;
  const activeSummary = list.find((item) => item.npc_id === activeNpcId);

  const loadRecord = (npcId: string) => {
    setSelectedNpcId(npcId);
    setMismatches(null);
  };

  useEffect(() => {
    if (!selectedNpcId) return;
    let cancelled = false;
    setRecord(null);
    medicalApi.getMedical(selectedNpcId).then((result) => {
      if (!cancelled) setRecord(result);
    }).catch(() => { if (!cancelled) setRecord(null); });
    return () => { cancelled = true; };
  }, [selectedNpcId]);

  const handleCompare = async () => {
    if (!activeNpcId || !activeSummary) return;
    const result = await medicalApi.compareMedical(activeNpcId, activeSummary.case_id);
    setMismatches(result.mismatches);
    notifyDataChanged();
  };

  const currentRecord = record && record.npc_id === activeNpcId ? record : null;

  useReadReceipt('medical', currentRecord?.npc_id ?? null, isActive && currentRecord !== null);

  return (
    <div className="workspace-layout medical-layout">
      <aside className="workspace-categories" aria-label="医疗库分类">
        <div className="section-label">医疗库分类</div>
        <ReadFilterTabs value={readFilter} onChange={(value) => { setReadFilter(value); setSelectedNpcId(null); setRecord(null); setMismatches(null); }} />
      </aside>
      <nav className="candidate-directory" aria-label="体检候选人目录">
        <div className="candidate-directory-heading"><strong>候选人</strong><span>{filteredList.length} 位</span></div>
        <div className="candidate-directory-list">
          {loading && <div style={{ padding: 8, fontSize: 10 }}>加载中...</div>}
          {filteredList.map((item) => (
            <button
              key={item.npc_id}
              className={`candidate-item ${activeNpcId === item.npc_id ? 'is-selected' : ''}`}
              aria-current={activeNpcId === item.npc_id ? 'true' : undefined}
              onClick={() => loadRecord(item.npc_id)}
            >
              <strong>{item.npc_name}</strong>
              <small>{item.npc_id}</small>
              <ReadStatus channel="medical" id={item.npc_id} />
            </button>
          ))}
          {!loading && filteredList.length === 0 && <p className="filter-empty">暂无符合条件的体检记录</p>}
        </div>
      </nav>
      <section className="workspace-detail medical-detail" aria-label="体检内容">
        <div className="medical-header"><span><strong>医疗档案库</strong><small>候选人体检记录</small></span></div>
        <div className="patient-record">
          {currentRecord ? (
            <>
              <div className="patient-title">
                <div>
                  <span className="patient-id">{currentRecord.npc_id}</span>
                  <h2>{activeSummary?.npc_name}</h2>
                </div>
              </div>
              <div className="vitals-grid">
                {currentRecord.fields.map((field) => (
                  <div key={field.key}>
                    <small>{field.label}</small>
                    <strong style={{ fontSize: 12 }}>{field.value}</strong>
                  </div>
                ))}
              </div>
              <div className="clinical-note">
                <span className="section-label">与简历比对</span>
                {mismatches && (
                  <div style={{ marginTop: 6 }}>
                    {mismatches.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {mismatches.map((clue) => (
                          <li key={clue.clue_id} style={{ marginBottom: 4 }}>
                            {clue.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>未发现不符之处</p>
                    )}
                  </div>
                )}
              </div>
              <div className="record-actions">
                <button onClick={handleCompare}>与简历比对</button>
              </div>
            </>
          ) : (
            <p>请选择一位候选人</p>
          )}
        </div>
      </section>
    </div>
  );
}
