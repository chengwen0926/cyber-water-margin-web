'use client';

import { useRef, type ReactNode } from 'react';

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

export function Icon({ type }: { type: string }) {
  return (
    <span className={`pixel-icon pixel-icon--${type}`} aria-hidden="true">
      <span className="pixel-icon__detail" />
    </span>
  );
}

export function WindowChrome({
  window,
  active,
  onClose,
  onFocus,
  onMove,
  children,
}: {
  window: WindowState;
  active: boolean;
  onClose: () => void;
  onFocus: () => void;
  onMove: (left: string, top: string) => void;
  children: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const dragState = useRef<{ startX: number; startY: number; originLeft: number; originTop: number } | null>(null);

  const handleDragStart = (event: React.MouseEvent) => {
    // Avoid starting a drag when the close button is clicked.
    if ((event.target as HTMLElement).closest('.window-close')) return;
    onFocus();
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragState.current || !sectionRef.current) return;
      const dx = moveEvent.clientX - dragState.current.startX;
      const dy = moveEvent.clientY - dragState.current.startY;
      const nextLeft = Math.max(0, dragState.current.originLeft + dx);
      const nextTop = Math.max(0, dragState.current.originTop + dy);
      sectionRef.current.style.left = `${nextLeft}px`;
      sectionRef.current.style.top = `${nextTop}px`;
    };

    const handleMouseUp = () => {
      if (sectionRef.current) {
        onMove(sectionRef.current.style.left, sectionRef.current.style.top);
      }
      dragState.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <section
      ref={sectionRef}
      className={`mac-window ${active ? 'mac-window--active' : ''}`}
      style={{
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
        zIndex: window.z,
      }}
      onMouseDown={onFocus}
      aria-label={window.title}
    >
      <div className="window-titlebar" onMouseDown={handleDragStart} onDoubleClick={onFocus}>
        <button className="window-close" aria-label={`Close ${window.title}`} onClick={onClose} />
        <div className="window-titlebar__stripe" />
        <span className="window-title">{window.title}</span>
      </div>
      <div className="window-content">{children}</div>
    </section>
  );
}
