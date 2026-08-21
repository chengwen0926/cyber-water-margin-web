'use client';

import { useState } from 'react';

import { archiveApi, medicalApi } from '@/lib/api';
import type { ArchiveSummary, Clue, MedicalRecordView } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useGame } from './GameProvider';

export function MedicalApp() {
  const { dataVersion, notifyDataChanged } = useGame();
  const { data: summaries, loading } = useApi<ArchiveSummary[]>(
    () => archiveApi.listArchive(),
    [dataVersion],
  );
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [record, setRecord] = useState<MedicalRecordView | null>(null);
  const [mismatches, setMismatches] = useState<Clue[] | null>(null);

  const list = summaries ?? [];
  const activeNpcId = selectedNpcId ?? list[0]?.npc_id ?? null;
  const activeSummary = list.find((item) => item.npc_id === activeNpcId);

  const loadRecord = (npcId: string) => {
    setSelectedNpcId(npcId);
    setMismatches(null);
    medicalApi.getMedical(npcId).then(setRecord).catch(() => setRecord(null));
  };

  const handleCompare = async () => {
    if (!activeNpcId || !activeSummary) return;
    const result = await medicalApi.compareMedical(activeNpcId, activeSummary.case_id);
    setMismatches(result.mismatches);
    notifyDataChanged();
  };

  const currentRecord = record && record.npc_id === activeNpcId ? record : null;

  return (
    <div className="medical-app">
      <div className="medical-header">
        <span>
          <strong>医疗档案库</strong>
          <small>CLINICAL INFORMATION NETWORK</small>
        </span>
        <div className="medical-session">
          <span className="status-dot" /> Session secure
        </div>
      </div>
      <div className="medical-body">
        <aside className="patient-list">
          <div className="section-label">候选人体检记录</div>
          {loading && <div style={{ padding: 8, fontSize: 10 }}>加载中...</div>}
          {list.map((item) => (
            <button
              key={item.npc_id}
              className={activeNpcId === item.npc_id ? 'is-selected' : ''}
              onClick={() => loadRecord(item.npc_id)}
            >
              <strong>{item.npc_name}</strong>
              <span>{item.npc_id}</span>
            </button>
          ))}
        </aside>
        <section className="patient-record">
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
        </section>
      </div>
    </div>
  );
}
