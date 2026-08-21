'use client';

import { useState } from 'react';

import { archiveApi, reviewApi } from '@/lib/api';
import type { ArchiveDetail, ArchiveSummary, CaseJudgement, Clue } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useGame } from './GameProvider';

export function ArchiveApp() {
  const { refetchQueue, dataVersion } = useGame();
  const { data: summaries, loading, refetch } = useApi<ArchiveSummary[]>(
    () => archiveApi.listArchive(),
    [dataVersion],
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [lastJudgement, setLastJudgement] = useState<CaseJudgement | null>(null);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [photoClue, setPhotoClue] = useState<Clue | null>(null);

  const list = summaries ?? [];
  const activeCaseId = selectedCaseId ?? list[0]?.case_id ?? null;

  const loadDetail = (caseId: string) => {
    setSelectedCaseId(caseId);
    setLastJudgement(null);
    setPhotoChecked(false);
    setPhotoClue(null);
    archiveApi
      .getArchive(caseId)
      .then(setDetail)
      .catch(() => setDetail(null));
  };

  const currentDetail = detail && detail.case.case_id === activeCaseId ? detail : null;

  const handleAutoFlag = async () => {
    if (!activeCaseId) return;
    const result = await archiveApi.autoFlagArchive(activeCaseId);
    setPhotoChecked(true);
    setPhotoClue(result.clue);
  };

  const handleVerdict = async (verdict: 'approved' | 'rejected') => {
    if (!activeCaseId) return;
    const judgement = await reviewApi.submitVerdict(activeCaseId, verdict);
    setLastJudgement(judgement);
    refetch();
    refetchQueue();
  };

  const activeSummary = list.find((item) => item.case_id === activeCaseId);
  const photo = currentDetail?.case.resume.photo;

  return (
    <div className="archive-app">
      <div className="app-toolbar">
        <span className="app-counter">{loading ? '加载中...' : `${list.length} 份档案`}</span>
        <button onClick={handleAutoFlag} disabled={!activeCaseId} className="default-button">
          一键发现问题
        </button>
      </div>
      <div className="archive-head">
        <span>候选人</span>
        <span>级别</span>
        <span>状态</span>
        <span>判定</span>
      </div>
      <div className="archive-list" role="listbox" aria-label="Archive records">
        {list.map((item) => (
          <button
            key={item.case_id}
            className={`archive-row ${activeCaseId === item.case_id ? 'is-selected' : ''}`}
            onClick={() => loadDetail(item.case_id)}
          >
            <span>{item.npc_id}</span>
            <strong>{item.npc_name}</strong>
            <span>{item.npc_level}</span>
            <span>{item.verdict ?? '待审查'}</span>
          </button>
        ))}
        {!loading && list.length === 0 && (
          <div style={{ padding: 12, color: '#777' }}>暂无已下载的档案，请先在邮箱中下载简历附件。</div>
        )}
      </div>

      {currentDetail && (
        <div style={{ borderTop: '1px solid #111', padding: 8, background: '#fff', overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {photo && (
              <div
                className={photoChecked && photo.is_anomalous ? 'is-falsified' : ''}
                style={{ flex: '0 0 96px', border: '1px solid #999', padding: 4, textAlign: 'center' }}
              >
                <div
                  style={{
                    width: 88,
                    height: 88,
                    background: '#dcdcdc',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 9,
                    color: '#888',
                  }}
                >
                  照片
                </div>
                <div style={{ fontSize: 8, marginTop: 4, color: '#555' }}>简历照片</div>
                {photoChecked && (
                  <div style={{ fontSize: 8, marginTop: 2, color: photo.is_anomalous ? '#a11' : '#2a7d33' }}>
                    {photo.is_anomalous ? '照片异常' : '照片正常'}
                  </div>
                )}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 6, fontWeight: 500 }}>{activeSummary?.npc_name} 简历字段</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <tbody>
                  {currentDetail.case.resume.fields.map((field) => (
                    <tr key={field.key}>
                      <td style={{ padding: '3px 6px', color: '#555' }}>{field.label}</td>
                      <td style={{ padding: '3px 6px' }}>{field.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 6, fontSize: 9, color: '#777' }}>
                文字字段的真实性无法在此确认，请前往「医疗库」与体检记录比对。
              </div>
            </div>
          </div>
          {photoChecked && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#555' }}>
              {photoClue ? `发现问题：${photoClue.description}` : '未发现照片异常'}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            {activeSummary?.verdict ? (
              <span style={{ fontSize: 10, color: '#555', alignSelf: 'center' }}>
                已判定：{activeSummary.verdict === 'approved' ? '通过' : '拒绝'}
              </span>
            ) : (
              <>
                <button className="default-button" onClick={() => handleVerdict('approved')}>
                  通过
                </button>
                <button className="default-button" onClick={() => handleVerdict('rejected')}>
                  拒绝
                </button>
              </>
            )}
            {lastJudgement && (
              <span style={{ fontSize: 10, color: lastJudgement.is_correct ? '#2a7d33' : '#a11', alignSelf: 'center' }}>
                {lastJudgement.is_correct ? '判定正确' : '判定有误'}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="app-statusbar">
        <span>档案系统 • 已解锁数据</span>
        <span>{activeCaseId ?? '未选择'}</span>
      </div>
    </div>
  );
}
