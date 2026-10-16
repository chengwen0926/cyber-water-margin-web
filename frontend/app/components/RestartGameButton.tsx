'use client';

import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import { fetchApi } from '@/lib/api';

export function RestartGameButton({disabled = false}: {disabled?: boolean}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const restart = async () => {
    if (lock.current || !window.confirm('确定重新开始游戏吗？\n剧情、聊天、档案、审查结果和桌面文件将重置，从第一天重新开始。\n显示设置保留，当前进度会自动备份。')) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await fetchApi('/api/game/reset', {method:'POST', body:JSON.stringify({confirmed:true})});
      window.location.reload();
    } catch (cause) {
      const detail = (cause as {body?: {detail?: unknown}})?.body?.detail;
      setError(typeof detail === 'string' ? detail : '未能确认重置结果，请刷新页面检查当前进度后重试。');
      lock.current = false; setBusy(false);
    }
  };
  return <>
    <button type="button" className="menu-link" disabled={disabled || busy} onClick={() => void restart()}>重新开始</button>
    {busy && createPortal(<div className="game-reset-overlay" role="alert" aria-busy="true">正在备份并重新开始…</div>, document.body)}
    {error && createPortal(<div className="game-reset-error" role="alert">{error}<button onClick={() => setError(null)}>关闭</button></div>, document.body)}
  </>;
}
