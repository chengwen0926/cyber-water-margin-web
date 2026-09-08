'use client';

import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

export type WindowId = 'archives' | 'email' | 'medical' | 'chat' | 'about' | 'notes' | 'trash';
export type WindowState = {
  id: WindowId;
  title: string;
  left: string;
  top: string;
  width: string;
  height: string;
  z: number;
};

type Bounds = Pick<WindowState, 'left' | 'top' | 'width' | 'height'>;
type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const directions: Direction[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function Icon({ type }: { type: string }) {
  return <span className={`pixel-icon pixel-icon--${type}`} aria-hidden="true"><span className="pixel-icon__detail" /></span>;
}

export function WindowChrome({ window: windowState, active, onClose, onFocus, onBoundsChange, children }: {
  window: WindowState;
  active: boolean;
  onClose: () => void;
  onFocus: () => void;
  onBoundsChange: (bounds: Bounds) => void;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const onChangeRef = useRef(onBoundsChange);
  onChangeRef.current = onBoundsChange;
  const gesture = useRef<{ pointerId: number; x: number; y: number; rect: DOMRect; direction?: Direction } | null>(null);

  const limits = () => {
    const desktop = sectionRef.current?.closest('.desktop');
    return {
      top: (desktop?.querySelector('.menubar')?.getBoundingClientRect().bottom ?? 25) + 4,
      right: globalThis.innerWidth - 4,
      bottom: globalThis.innerHeight - 4,
    };
  };
  const commit = (left: number, top: number, width: number, height: number) => {
    onChangeRef.current({ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
  };

  useEffect(() => {
    const fit = () => {
      const rect = sectionRef.current?.getBoundingClientRect();
      if (!rect) return;
      const limit = limits();
      const width = Math.min(rect.width, limit.right - 4);
      const height = Math.min(rect.height, limit.bottom - limit.top);
      commit(clamp(rect.left, 4, limit.right - width), clamp(rect.top, limit.top, limit.bottom - height), width, height);
    };
    fit();
    globalThis.addEventListener('resize', fit);
    return () => globalThis.removeEventListener('resize', fit);
  }, []);

  const start = (event: PointerEvent<HTMLElement>, direction?: Direction) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.window-close')) return;
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect, direction };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const state = gesture.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const { rect, direction } = state;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    const limit = limits();
    if (!direction) {
      commit(clamp(rect.left + dx, 4, limit.right - rect.width), clamp(rect.top + dy, limit.top, limit.bottom - rect.height), rect.width, rect.height);
      return;
    }
    const minWidth = Math.min(245, limit.right - 4);
    const minHeight = Math.min(150, limit.bottom - limit.top);
    const left = direction.includes('w') ? clamp(rect.left + dx, 4, rect.right - minWidth) : rect.left;
    const top = direction.includes('n') ? clamp(rect.top + dy, limit.top, rect.bottom - minHeight) : rect.top;
    const right = direction.includes('e') ? clamp(rect.right + dx, rect.left + minWidth, limit.right) : rect.right;
    const bottom = direction.includes('s') ? clamp(rect.bottom + dy, rect.top + minHeight, limit.bottom) : rect.bottom;
    commit(left, top, right - left, bottom - top);
  };
  const finish = () => { gesture.current = null; };

  return (
    <section ref={sectionRef} className={`mac-window ${active ? 'mac-window--active' : ''}`}
      style={{ left: windowState.left, top: windowState.top, width: windowState.width, height: windowState.height, zIndex: windowState.z }}
      onPointerDown={onFocus} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} aria-label={windowState.title}>
      <div className="window-titlebar" onPointerDown={(event) => start(event)}>
        <button className="window-close" aria-label={`Close ${windowState.title}`} onClick={onClose} />
        <div className="window-titlebar__stripe" />
        <span className="window-title">{windowState.title}</span>
      </div>
      <div className="window-content">{children}</div>
      {directions.map((direction) => <div key={direction} className={`window-resize window-resize--${direction}`} aria-hidden="true" onPointerDown={(event) => start(event, direction)} />)}
    </section>
  );
}
