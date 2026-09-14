'use client';

import { createPortal } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FILE_MIME, workspaceApi, errorText, type FileDocument, type FileSource, type DesktopState, type DesktopItem, type DesktopSettings } from '@/lib/workspace';
import { useGame } from './GameProvider';
import { WindowChrome, type WindowState } from './WindowChrome';

export function readDrop(event: DragEvent): { source?: FileSource; item_id?: string } | null {
  try { return JSON.parse(event.dataTransfer.getData(FILE_MIME)); } catch { return null; }
}
const Context = createContext<null | {
  state: DesktopState; busy: string | null; notice: string | null;
  preview: (source: FileSource) => void; run: <T>(label: string, action: () => Promise<T>) => Promise<T | undefined>;
  item: (body: Parameters<typeof workspaceApi.item>[0]) => Promise<void>;
  drop: (event: DragEvent, parent?: string | null) => void;
  openFolder: (id: string | null) => void; openSettings: () => void; openTrash: () => void;
}>(null);
export function useFiles() { const ctx = useContext(Context); if (!ctx) throw new Error('FileSystemProvider missing'); return ctx; }

export function FileTile({ source, name, item, onOpen }: {source?: FileSource; name: string; item?: DesktopItem; onOpen?: () => void}) {
  const files = useFiles();
  const [dragging, setDragging] = useState(false);
  const [ghost, setGhost] = useState<{x:number;y:number} | null>(null);
  const gesture = useRef<{x:number;y:number; moved:boolean; target:Element | null; data:DataTransfer} | null>(null);
  const endDrag = (cancelled = false) => {
    const current = gesture.current;
    if (current?.moved && current.target) {
      if (!cancelled) current.target.dispatchEvent(new DragEvent('drop', {bubbles:true,cancelable:true,dataTransfer:current.data}));
      current.target.dispatchEvent(new DragEvent('dragleave', {bubbles:true,dataTransfer:current.data}));
    }
    gesture.current = null; setGhost(null); setDragging(false);
  };
  return <><button type="button" className={`file-tile ${dragging ? 'file-tile--dragging' : ''}`} draggable={false}
    onPointerDown={event => {
      if(event.button !== 0) return;
      const data = new DataTransfer();
      data.setData(FILE_MIME,JSON.stringify(item ? {item_id:item.id,source:item.source} : {source}));
      gesture.current = {x:event.clientX,y:event.clientY,moved:false,target:null,data};
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const current = gesture.current; if(!current) return;
      if(!current.moved && Math.hypot(event.clientX-current.x,event.clientY-current.y)<6) return;
      current.moved=true; setDragging(true); setGhost({x:event.clientX,y:event.clientY});
      const target = document.elementFromPoint(event.clientX,event.clientY);
      if(current.target !== target) current.target?.dispatchEvent(new DragEvent('dragleave',{bubbles:true,dataTransfer:current.data}));
      current.target=target;
      target?.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:current.data}));
    }}
    onPointerUp={() => endDrag()} onPointerCancel={() => endDrag(true)} onLostPointerCapture={() => {if(gesture.current) endDrag(true);}}
    onDragStart={event => { event.stopPropagation(); event.dataTransfer.setData(FILE_MIME, JSON.stringify(item ? {item_id: item.id, source: item.source} : {source})); event.dataTransfer.effectAllowed = item ? 'move' : 'copy'; setDragging(true); }}
    onDragEnd={() => setDragging(false)}
    onDragOver={event => { if (item?.kind === 'folder' && event.dataTransfer.types.includes(FILE_MIME)) { event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.add('file-drop-hover'); } }}
    onDragLeave={event => event.currentTarget.classList.remove('file-drop-hover')}
    onDrop={event => { event.currentTarget.classList.remove('file-drop-hover'); if (item?.kind === 'folder') files.drop(event, item.id); }}
    onDoubleClick={() => onOpen ? onOpen() : source ? files.preview(source) : undefined}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (onOpen) onOpen(); else if (source) files.preview(source); } }}
    title={`${name} · 双击打开，可拖拽`}><span className={`file-glyph ${item?.kind === 'folder' ? 'file-glyph--folder' : ''}`} aria-hidden="true">{item?.kind === 'folder' ? '' : source?.kind === 'medical' ? '＋' : source?.kind === 'chat' ? '···' : '≡'}</span><span>{name}</span></button>{ghost && createPortal(<div className="file-drag-ghost" style={{left:ghost.x+16,top:ghost.y+12}}>▤ {name}</div>,document.body)}</>;
}

function Floating({ title, id, children, close }: {title: string; id: 'files' | 'preview' | 'settings'; children: ReactNode; close: () => void}) {
  const [bounds, setBounds] = useState<WindowState>({id, title, left: '22%', top: '12%', width: id === 'preview' ? '620px' : '540px', height: id === 'settings' ? '370px' : '560px', z: 500});
  return <div className="fs-floating"><WindowChrome window={{...bounds, title}} active onFocus={() => {}} onClose={close} onBoundsChange={next => setBounds(old => ({...old,...next}))}>{children}</WindowChrome></div>;
}

export function FileSystemProvider({ children }: {children: ReactNode}) {
  const { notifyDataChanged } = useGame();
  const [state, setState] = useState<DesktopState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [doc, setDoc] = useState<FileDocument | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [folder, setFolder] = useState<string | null | undefined>(undefined);
  const [trash, setTrash] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; workspaceApi.state().then(setState).catch(error => setNotice(errorText(error))); return () => { mounted.current = false; }; }, []);
  const run = useCallback(async <T,>(label: string, action: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return;
    lock.current = true; setBusy(label); setNotice(null);
    try {
      const result = await Promise.all([action(), new Promise(resolve => setTimeout(resolve, 1000))]);
      if (mounted.current) { setNotice('操作完成'); notifyDataChanged(); }
      return result[0];
    } catch (error) { if (mounted.current) setNotice(errorText(error)); }
    finally { lock.current = false; if (mounted.current) setBusy(null); }
  }, [notifyDataChanged]);
  const item = async (body: Parameters<typeof workspaceApi.item>[0]) => { const result = await run('正在整理文件…', () => workspaceApi.item(body)); if (result) setState(result); };
  const preview = async (source: FileSource) => { if (lock.current) return; setDoc(null); setPreviewOpen(true); const result = await run('正在打开文件…', () => workspaceApi.document(source)); if (result) setDoc(result); };
  const drop = (event: DragEvent, parent: string | null = null) => { event.preventDefault(); event.stopPropagation(); const payload = readDrop(event); if (payload?.item_id) void item({action:'move', item_id:payload.item_id, parent_id:parent}); else if (payload?.source) void item({action:'copy', source:payload.source, parent_id:parent}); };
  if (!state) return <div className="fs-start"><p>{notice ?? '正在载入个人桌面…'}</p>{notice && <button onClick={() => workspaceApi.state().then(setState).catch(e => setNotice(errorText(e)))}>重新连接</button>}</div>;
  return <Context.Provider value={{state, busy, notice, run, item, preview, drop, openFolder: id => {setFolder(id);setTrash(false);}, openTrash: () => {setFolder(null);setTrash(true);}, openSettings: () => setSettingsOpen(true)}}>
    <div className={state.settings.motion ? '' : 'reduce-desktop-motion'} style={{'--file-icon-size': `${state.settings.icon_size}px`, '--desktop-icon-scale': state.settings.icon_size / 64} as React.CSSProperties}>
      {children}
      {folder !== undefined && <Floating id="files" title={trash ? '废纸篓' : folder ? state.items.find(i => i.id === folder)?.name ?? '文件夹' : '桌面文件'} close={() => setFolder(undefined)}><FolderContents parent={folder} trash={trash} /></Floating>}
      {previewOpen && <Floating id="preview" title={doc?.title ?? '文件预览'} close={() => setPreviewOpen(false)}><div className="file-preview">{doc ? <><p className="file-eyebrow">LOCALNET · 原始文件</p><h1>{doc.title}</h1>{doc.contact && <p>联系方式：<strong>{doc.contact}</strong></p>}<dl>{doc.fields.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl><p className="file-body">{doc.body}</p><div className="file-actions"><button onClick={() => void item({action:'copy',source:doc.source})}>保存到桌面</button>{doc.source.kind === 'resume' && <button onClick={() => void run('正在提取简历…', () => workspaceApi.import(doc.source))}>建立档案</button>}{doc.contact && <button onClick={() => void run('正在添加好友…', () => workspaceApi.friend(doc.contact!))}>添加为好友</button>}</div></> : <p role="status">{busy ?? notice ?? '文件加载失败，请关闭后重试'}</p>}</div></Floating>}
      {settingsOpen && <Floating id="settings" title="显示设置" close={() => setSettingsOpen(false)}><SettingsPanel initial={state.settings} save={async settings => { const ok = await run('正在保存设置…', () => workspaceApi.settings(settings)); if (ok) setState(old => old && ({...old,settings})); }} /></Floating>}
      {(busy || notice) && <div className={`fs-notification ${busy ? 'fs-notification--busy' : ''}`} role="status">{busy && <span className="fs-spinner" />}{busy ?? notice}<button aria-label="关闭操作提示" disabled={!!busy} onClick={() => setNotice(null)}>×</button></div>}
      <div className="screen-brightness" style={{opacity: 1 - state.settings.brightness / 100}} />
    </div>
  </Context.Provider>;
}

function SettingsPanel({initial, save}: {initial: DesktopSettings; save: (s: DesktopSettings) => void}) {
  const [value, setValue] = useState(initial);
  return <form className="display-settings" onSubmit={e => {e.preventDefault();save(value);}}><h2>显示与操作</h2><label>游戏屏幕亮度 · {value.brightness}%<input type="range" min="40" max="100" value={value.brightness} onChange={e => setValue({...value,brightness:Number(e.target.value)})} /></label><label>图标大小 · {value.icon_size}px<input type="range" min="48" max="96" step="8" value={value.icon_size} onChange={e => setValue({...value,icon_size:Number(e.target.value)})} /></label><label><input type="checkbox" checked={value.motion} onChange={e => setValue({...value,motion:e.target.checked})} />启用窗口与拖拽动效</label><button type="submit">应用设置</button></form>;
}

function FolderContents({parent, trash}: {parent: string | null; trash: boolean}) {
  const files = useFiles();
  const [name, setName] = useState('');
  const entries = files.state.items.filter(i => trash ? i.deleted : !i.deleted && i.parent_id === parent);
  return <div className="folder-browser" onDragOver={e => {if (!trash && e.dataTransfer.types.includes(FILE_MIME)) e.preventDefault();}} onDrop={e => {if (!trash) files.drop(e,parent);}}>
    <div className="folder-toolbar">{!trash && <><button onClick={() => files.openFolder(parent ? files.state.items.find(i => i.id === parent)?.parent_id ?? null : null)}>上一级</button><input aria-label="新文件夹名称" placeholder="新文件夹名称" value={name} onChange={e => setName(e.target.value)} /><button disabled={!name.trim()} onClick={() => {void files.item({action:'folder',parent_id:parent,name});setName('');}}>新建文件夹</button></>}</div>
    <div className="folder-file-grid">{entries.map(i => <div key={i.id}><FileTile item={i} source={i.source ?? undefined} name={i.name} onOpen={() => {if (trash) return; if (i.kind === 'folder') files.openFolder(i.id); else if (i.source) files.preview(i.source);}} />{trash ? <button onClick={() => void files.item({action:'restore',item_id:i.id})}>恢复到桌面</button> : <button onClick={() => void files.item({action:'delete',item_id:i.id})}>移到废纸篓</button>}</div>)}</div>{!entries.length && <p className="folder-empty">{trash ? '废纸篓是空的' : '将邮件附件或桌面文件拖到这里'}</p>}
  </div>;
}

export function DesktopFiles() {
  const files = useFiles();
  const [menu, setMenu] = useState<{x:number;y:number;item?:DesktopItem} | null>(null);
  const [edit, setEdit] = useState<{item?: DesktopItem; name: string} | null>(null);
  return <>
    <div className="desktop-file-surface" onContextMenu={e => {e.preventDefault();setMenu({x:Math.min(e.clientX,innerWidth-200),y:Math.min(e.clientY,innerHeight-180)});}} onClick={() => setMenu(null)} onDragOver={e => {if(e.dataTransfer.types.includes(FILE_MIME)) e.preventDefault();}} onDrop={e => files.drop(e)}>
      <div className="desktop-file-grid">{files.state.items.filter(i => !i.deleted && !i.parent_id).map(item => <div key={item.id} onContextMenu={e => {e.preventDefault();e.stopPropagation();setMenu({x:Math.min(e.clientX,innerWidth-200),y:Math.min(e.clientY,innerHeight-180),item});}}><FileTile item={item} source={item.source ?? undefined} name={item.name} onOpen={() => item.kind === 'folder' ? files.openFolder(item.id) : item.source && files.preview(item.source)} /></div>)}</div>
    </div>
    <div className="desktop-file-tools"><button onClick={() => setEdit({name:'新建文件夹'})}>新建文件夹</button><button onClick={() => files.openFolder(null)}>桌面文件</button><button onClick={files.openSettings}>显示设置</button></div>
    {menu && <div className="desktop-context-menu" style={{left:menu.x,top:menu.y}} role="menu">{menu.item ? <><button role="menuitem" onClick={() => {setEdit({item:menu.item,name:menu.item!.name});setMenu(null);}}>重命名</button><button role="menuitem" onClick={() => {void files.item({action:'delete',item_id:menu.item!.id});setMenu(null);}}>移到废纸篓</button></> : <button role="menuitem" onClick={() => {setEdit({name:'新建文件夹'});setMenu(null);}}>新建文件夹</button>}<button role="menuitem" onClick={() => {files.openSettings();setMenu(null);}}>显示设置</button><button role="menuitem" onClick={() => setMenu(null)}>关闭菜单</button></div>}
    {edit && <div className="fs-name-backdrop"><form className="fs-name-dialog" onSubmit={e => {e.preventDefault();void files.item({action:edit.item?'rename':'folder',item_id:edit.item?.id,name:edit.name});setEdit(null);}}><label>{edit.item?'重命名':'新建文件夹'}<input autoFocus maxLength={80} value={edit.name} onChange={e => setEdit({...edit,name:e.target.value})} /></label><button type="submit" disabled={!edit.name.trim()}>确定</button><button type="button" onClick={() => setEdit(null)}>取消</button></form></div>}
  </>;
}
