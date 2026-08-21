'use client';

import { useState } from 'react';

import type { DayResult } from '@/lib/api';

export function SettlementModal({
  result,
  onClose,
}: {
  result: DayResult;
  onClose: () => void | Promise<void>;
}) {
  const [advancing, setAdvancing] = useState(false);

  const handleContinue = async () => {
    setAdvancing(true);
    try {
      await onClose();
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.35)',
        zIndex: 999,
      }}
    >
      <section className="mac-window" style={{ position: 'relative', width: 360, height: 'auto' }}>
        <div className="window-titlebar">
          <span className="window-title">第{result.day}天结算</span>
        </div>
        <div className="window-content" style={{ padding: 12, height: 'auto' }}>
          <p>总案例数：{result.total_count}</p>
          <p>判断错误数：{result.error_count}</p>
          <p>错误率：{(result.error_rate * 100).toFixed(1)}%</p>
          {result.penalty_triggered ? (
            <p style={{ color: '#a11' }}>
              触发惩罚：{result.penalty_triggered.action.action_type}
            </p>
          ) : (
            <p style={{ color: '#2a7d33' }}>今日无惩罚</p>
          )}
          <button className="default-button" onClick={handleContinue} disabled={advancing} style={{ marginTop: 10 }}>
            {result.is_final_day
              ? advancing
                ? '正在结算...'
                : '查看结果'
              : advancing
                ? '正在进入下一天...'
                : '进入下一天'}
          </button>
        </div>
      </section>
    </div>
  );
}
