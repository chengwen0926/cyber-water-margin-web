'use client';

export function GameOverModal({ finalDay }: { finalDay: number }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
    >
      <section className="mac-window" style={{ position: 'relative', width: 380, height: 'auto' }}>
        <div className="window-titlebar">
          <span className="window-title">游戏结束</span>
        </div>
        <div className="window-content" style={{ padding: 16, height: 'auto', textAlign: 'center' }}>
          <h2 style={{ margin: '4px 0 10px' }}>入职审查工作已全部完成</h2>
          <p style={{ margin: '0 0 6px' }}>
            你已完成第 1 至第 {finalDay} 天的全部审查任务。
          </p>
          <p style={{ margin: 0, color: '#555' }}>感谢你参与《赛博水浒入职日》。</p>
        </div>
      </section>
    </div>
  );
}
