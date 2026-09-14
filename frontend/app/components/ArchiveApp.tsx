'use client';

import { FileTile, readDrop, useFiles } from './FileSystem';
import { FILE_MIME, workspaceApi, type Assessment, type LibraryRecord } from '@/lib/workspace';
import { useEffect, useRef, useState } from 'react';
import { archiveApi, reviewApi } from '@/lib/api';
import type { ArchiveDetail, ArchiveSummary, CaseJudgement, Clue, ResumeField } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ReadFilterTabs, type ReadFilter, ReadStatus, useReadReceipt, useReading } from './ReadingProvider';
import { useGame } from './GameProvider';

const levelLabels: Record<string, string> = { intern: '实习生', staff: '正式员工', senior: '高级员工' };
const sections = [
  { title: '基本信息', keys: ['gender', 'marital_status'] },
  { title: '教育背景', keys: ['graduation_year'] },
  { title: '工作经历', keys: ['prior_employment'] },
  { title: '补充信息', keys: ['health_status', 'criminal_record'] },
];

function ResumeSection({ title, fields }: { title: string; fields: ResumeField[] }) {
  if (!fields.length) return null;
  return <section className="resume-section">
    <h3>{title}</h3>
    <dl>{fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.value || '未填写'}</dd></div>)}</dl>
  </section>;
}

function ResumePhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="resume-photo">
    {src && !failed ? <img src={src} alt={`${name}的简历照片`} onError={() => setFailed(true)} /> :
      <div className="resume-photo-placeholder"><span aria-hidden="true">▧</span><small>暂无照片</small></div>}
  </div>;
}

export function ArchiveApp({ isActive }: { isActive: boolean }) {
  const files = useFiles();
  const [collection, setCollection] = useState<'candidates' | 'library'>('candidates');
  const [dragOver, setDragOver] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LibraryRecord | null>(null);
  const {data: library} = useApi<LibraryRecord[]>(workspaceApi.library, []);
  const { entries } = useReading();
  const { refetchQueue, dataVersion } = useGame();
  const { data: summaries, loading, error: listError, refetch } = useApi<ArchiveSummary[]>(() => archiveApi.listArchive(), [dataVersion]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const {data: assessment, refetch: refreshAssessment} = useApi<Assessment | null>(() => selectedCaseId ? workspaceApi.assessment(selectedCaseId) : Promise.resolve(null), [selectedCaseId, dataVersion]);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastJudgement, setLastJudgement] = useState<CaseJudgement | null>(null);
  const [photoChecked, setPhotoChecked] = useState(false);
  const [photoClue, setPhotoClue] = useState<Clue | null>(null);
  const [busy, setBusy] = useState<'photo' | 'verdict' | null>(null);
  const [retry, setRetry] = useState(0);
  const selection = useRef(selectedCaseId);
  selection.current = selectedCaseId;
  const pendingAction = useRef(false);

  const list = summaries ?? [];
  const filteredList = list.filter((item) => readFilter === 'all' || entries.archive[item.case_id]?.is_read === (readFilter === 'read'));
  const activeSummary = list.find((item) => item.case_id === selectedCaseId);
  const currentDetail = detail?.case.case_id === selectedCaseId ? detail : null;
  const resume = currentDetail?.case.resume;
  const judgement = lastJudgement?.case_id === selectedCaseId ? lastJudgement : null;
  const verdict = judgement?.player_verdict ?? activeSummary?.verdict;
  const status = verdict === 'approved' ? '已通过' : verdict === 'rejected' ? '已拒绝' : '待审查';

  useEffect(() => {
    setDetail(null);
    setLastJudgement(null);
    setPhotoChecked(false);
    setPhotoClue(null);
    setError(null);
    setDetailLoading(false);
    if (!selectedCaseId) return;
    let cancelled = false;
    setDetailLoading(true);
    archiveApi.getArchive(selectedCaseId).then((result) => {
      if (!cancelled) setDetail(result);
    }).catch(() => { if (!cancelled) setError('简历加载失败，请重试。'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCaseId, retry]);

  useReadReceipt('archive', currentDetail?.case.case_id ?? null, isActive && currentDetail !== null);

  const handleAutoFlag = async () => {
    if (!selectedCaseId || !resume || pendingAction.current) return;
    const caseId = selectedCaseId;
    pendingAction.current = true;
    setBusy('photo');
    setError(null);
    try {
      const result = await archiveApi.autoFlagArchive(caseId);
      if (selection.current !== caseId) return;
      setPhotoChecked(true);
      setPhotoClue(result.clue);
    } catch {
      if (selection.current === caseId) setError('照片检查失败，请重试。');
    } finally {
      pendingAction.current = false;
      setBusy(null);
    }
  };

  const handleVerdict = async (nextVerdict: 'approved' | 'rejected') => {
    if (!selectedCaseId || !resume || verdict || pendingAction.current) return;
    const caseId = selectedCaseId;
    pendingAction.current = true;
    setBusy('verdict');
    setError(null);
    try {
      const result = await reviewApi.submitVerdict(caseId, nextVerdict);
      if (selection.current === caseId) setLastJudgement(result);
      refetch();
      refetchQueue();
    } catch {
      if (selection.current === caseId) setError('判定提交失败，请重试。');
    } finally {
      pendingAction.current = false;
      setBusy(null);
    }
  };

  const assessmentView = assessment?.case_id === selectedCaseId ? assessment : null;
  return <div className={`archive-workbench ${dragOver ? 'archive-workbench--dragover' : ''}`}
    onDragOver={event => {if(event.dataTransfer.types.includes(FILE_MIME)){event.preventDefault();setDragOver(true);event.dataTransfer.dropEffect='copy';}}}
    onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false);}}
    onDrop={async event => {event.preventDefault();event.stopPropagation();setDragOver(false);const payload=readDrop(event);if(!payload?.source)return;const source=payload.source;const result=await files.run('正在提取信息并评估风险…',()=>workspaceApi.import(source,source.kind==='resume'?undefined:selectedCaseId??undefined));if(result){setCollection('candidates');setSelectedCaseId(result.case_id);setRetry(v=>v+1);refetch();refreshAssessment();}}}>
    <header className="archive-command-bar"><div><strong>集团档案库</strong><small>材料归档 · 交叉核验 · 历史资料</small></div><label className="archive-search-shell"><input disabled placeholder="搜索人物、档案或事件（即将开放）" aria-label="档案搜索，暂未开放" /></label></header>
    <div className="archive-collection-tabs"><button className={collection==='candidates'?'is-active':''} onClick={()=>setCollection('candidates')}>候选人档案 · {list.length}</button><button className={collection==='library'?'is-active':''} onClick={()=>setCollection('library')}>集团人物与事件 · {library?.length??0}</button><span>拖入简历建档；其他材料归入当前候选人</span></div>
    {collection==='library' ? <div className="company-library"><nav aria-label="集团历史档案">{library?.map(record=><button key={record.id} className={selectedRecord?.id===record.id?'is-selected':''} onClick={()=>setSelectedRecord(record)}><small>{record.kind} · {record.date}</small><strong>{record.title}</strong></button>)}</nav><article>{selectedRecord?<><p className="file-eyebrow">集团历史档案 · {selectedRecord.kind}</p><h1>{selectedRecord.title}</h1><p className="file-body">{selectedRecord.body}</p><FileTile name="历史档案原件" source={{kind:'history',id:selectedRecord.id}} /><p>可保存到桌面，作为人物背景材料归档。历史资料不替代候选人的核验原件。</p></>:<div className="resume-empty"><h2>集团的过去，留在档案里</h2><p>从左侧选择人物、事件或内部新闻。</p></div>}</article></div> : <div className="archive-layout">
      <aside className="archive-sidebar" aria-label="档案分类">
        <div className="section-label">档案分类</div>
        <ReadFilterTabs value={readFilter} onChange={(value) => { setReadFilter(value); setSelectedCaseId(null); }} />
      </aside>
      <nav className="candidate-directory" aria-label="候选人目录">
        <div className="candidate-directory-heading"><strong>候选人</strong><span>{filteredList.length} 份</span></div>
        <div className="candidate-directory-list">
          {filteredList.map((item) => <button key={item.case_id} type="button"
            className={`candidate-item ${selectedCaseId === item.case_id ? 'is-selected' : ''}`}
            aria-current={selectedCaseId === item.case_id ? 'true' : undefined}
            onClick={() => setSelectedCaseId(item.case_id)}>
            <strong>{item.npc_name}</strong>
            <small>{levelLabels[item.npc_level] ?? item.npc_level}</small>
            <ReadStatus channel="archive" id={item.case_id} />
          </button>)}
          {loading && <p className="filter-empty">加载目录中…</p>}
          {!loading && !listError && filteredList.length === 0 && <p className="filter-empty">{list.length ? '此分类下暂无档案' : '将简历附件拖到这里，建立候选人档案'}</p>}
          {!!listError && <div className="filter-empty" role="alert">目录加载失败<button className="default-button" onClick={refetch}>重试</button></div>}
        </div>
      </nav>
      <section className="resume-viewer" aria-label="候选人简历">
        {resume && activeSummary ? (
          <article className="resume-sheet" key={selectedCaseId} aria-label={`${activeSummary.npc_name}的完整简历`}>
            <header className="resume-heading">
              <div className="resume-identity">
                <p className="resume-kicker">个人简历 / RESUME</p>
                <h1>{activeSummary.npc_name}</h1>
                <p className="resume-level">候选人级别 · {levelLabels[activeSummary.npc_level] ?? activeSummary.npc_level}</p>
                <span className={`resume-status resume-status--${verdict ?? 'pending'}`}>{status}</span>
              </div>
              <ResumePhoto key={resume.photo.photo_url} src={resume.photo.photo_url} name={activeSummary.npc_name} />
            </header>
            <div className="archive-contact-line">联系方式：<strong>{activeSummary.npc_id}@localnet</strong><button onClick={()=>void files.run('正在添加好友…',()=>workspaceApi.friend(`${activeSummary.npc_id}@localnet`))}>添加好友</button></div>
            {assessmentView && <section className="risk-assessment" aria-label="档案风险评估"><h3>材料核验评估</h3><div className="risk-counters"><span><b>{assessmentView.unknown}</b> 待核实</span><span><b>{assessmentView.conflicts}</b> 材料矛盾</span><span><b>{assessmentView.verified}</b> 已一致</span></div><p>{assessmentView.summary}</p><div className="risk-points">{assessmentView.points.map(point=><div key={point.key} className={`risk-point risk-point--${point.status}`}><strong>{point.label}</strong><span>{point.status==='unknown'?'待核实':point.status==='conflict'?'存在矛盾':'已核实一致'}</span>{point.status==='conflict'&&<small>简历：{point.declared} / 原件：{point.verified}</small>}</div>)}</div><div className="archive-evidence-tray"><strong>已归档材料 · {assessmentView.evidence.length}</strong><p>将核验原件、对话记录或背景材料拖到此窗口。</p>{assessmentView.evidence.map(doc=><span className="evidence-chip" key={`${doc.source.kind}:${doc.source.id}`}>{doc.title}</span>)}</div></section>}
            <div className="resume-body">
              {sections.map((section) => <ResumeSection key={section.title} title={section.title} fields={resume.fields.filter((field) => section.keys.includes(field.key))} />)}
              <ResumeSection title="其他资料" fields={resume.fields.filter((field) => !sections.some((section) => section.keys.includes(field.key)))} />
              {resume.attachments.length > 0 && <section className="resume-section">
                <h3>随附材料</h3>
                <ul className="resume-attachments">{resume.attachments.map((attachment, index) => <li key={`${attachment}-${index}`}>{attachment.split('/').pop()}</li>)}</ul>
              </section>}
            </div>
            <section className="resume-review" aria-label="简历审查">
              <div className="resume-review-heading"><h3>审查记录</h3><span className={`resume-status resume-status--${verdict ?? 'pending'}`}>{status}</span></div>
              <div className="resume-photo-check">
                <span>{photoChecked ? photoClue ? '照片异常' : '未发现照片异常' : '照片尚未核验'}</span>
                <button className="default-button" onClick={handleAutoFlag} disabled={busy !== null}>{busy === 'photo' ? '检查中…' : '检查简历照片'}</button>
              </div>
              {photoChecked && photoClue && <p className="resume-clue" role="status">{photoClue.description}</p>}
              <p className="resume-note">文字信息请前往医疗库核对。阅读简历不代表已完成审查。</p>
              <div className="resume-actions">
                <button className="default-button resume-approve" onClick={() => handleVerdict('approved')} disabled={busy !== null || !!verdict}>通过</button>
                <button className="default-button resume-reject" onClick={() => handleVerdict('rejected')} disabled={busy !== null || !!verdict}>拒绝</button>
                <span role="status">{busy === 'verdict' ? '正在提交判定…' : judgement ? judgement.is_correct ? '判定正确' : '判定有误' : verdict ? '判定已提交' : '请选择审查结果'}</span>
              </div>
              {error && <p className="resume-error" role="alert">{error}</p>}
            </section>
            <footer className="resume-footer"><span>档案编号 · {selectedCaseId}</span><span>候选人 · {activeSummary.npc_id}</span></footer>
          </article>
        ) : <div className="resume-empty" role="status">
          <span className="resume-empty-icon" aria-hidden="true">▤</span>
          <h2>{detailLoading ? '正在载入简历…' : selectedCaseId ? '简历暂不可用' : '选择一位候选人'}</h2>
          <p>{error ?? '从左侧候选人目录打开完整简历，在简历中核验资料并提交审查结果。'}</p>
          {error && <button className="default-button" onClick={() => setRetry((value) => value + 1)}>重新加载</button>}
        </div>}
      </section>
    </div>}
    {dragOver && <div className="archive-drop-indicator">松开鼠标，提取材料并更新档案评估</div>}
  </div>;
}
