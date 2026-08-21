'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { settlementApi } from '@/lib/api';
import type { DayResult } from '@/lib/api';
import { ArchiveApp } from './components/ArchiveApp';
import { ChatApp } from './components/ChatApp';
import { EmailApp } from './components/EmailApp';
import { GameOverModal } from './components/GameOverModal';
import { GameProvider, useGame } from './components/GameProvider';
import { MedicalApp } from './components/MedicalApp';
import { SettlementModal } from './components/SettlementModal';
import { Icon, WindowChrome } from './components/WindowChrome';
import type { WindowId, WindowState } from './components/WindowChrome';

const APP_NAMES: Record<WindowId, string> = {
  archives: '档案',
  email: '邮箱',
  medical: '医疗库',
  chat: '聊天',
  about: 'About This Macintosh',
  notes: 'ReadMe',
  trash: 'Trash',
};

const initialWindows: WindowState[] = [
  { id: 'archives', title: APP_NAMES.archives, left: '15%', top: '17%', width: '610px', height: '390px', z: 3 },
  { id: 'email', title: APP_NAMES.email, left: '24%', top: '15%', width: '650px', height: '410px', z: 0 },
  { id: 'medical', title: APP_NAMES.medical, left: '18%', top: '18%', width: '680px', height: '430px', z: 0 },
  { id: 'chat', title: APP_NAMES.chat, left: '30%', top: '20%', width: '570px', height: '380px', z: 0 },
  { id: 'about', title: APP_NAMES.about, left: '54%', top: '20%', width: '305px', height: '235px', z: 0 },
  { id: 'notes', title: APP_NAMES.notes, left: '25%', top: '58%', width: '315px', height: '205px', z: 0 },
  { id: 'trash', title: APP_NAMES.trash, left: '69%', top: '61%', width: '280px', height: '178px', z: 0 },
];

const menuItems = ['File', 'Edit', 'View', 'Special'];


function DesktopShell() {
  const { advanceDay, dayComplete } = useGame();
  const [windows, setWindows] = useState(initialWindows);
  const [activeWindow, setActiveWindow] = useState<WindowId>('archives');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [time, setTime] = useState('9:41 AM');
  const [settlement, setSettlement] = useState<DayResult | null>(null);
  const [settling, setSettling] = useState(false);
  const [gameOver, setGameOver] = useState<{ finalDay: number } | null>(null);
  const settledForCurrentDay = useRef(false);

  useEffect(() => {
    const update = () =>
      setTime(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date()));
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dayComplete || settledForCurrentDay.current) return;
    settledForCurrentDay.current = true;
    setSettling(true);
    settlementApi
      .settleToday()
      .then(setSettlement)
      .finally(() => setSettling(false));
  }, [dayComplete]);

  const visibleWindows = useMemo(() => windows.filter((item) => item.z > 0), [windows]);

  const focusWindow = (id: WindowId) => {
    const highest = Math.max(...windows.map((item) => item.z), 0);
    setActiveWindow(id);
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, z: highest + 1 } : item)));
  };
  const closeWindow = (id: WindowId) => setWindows((current) => current.map((item) => (item.id === id ? { ...item, z: 0 } : item)));
  const openWindow = (id: WindowId) => {
    const highest = Math.max(...windows.map((item) => item.z), 0);
    setActiveWindow(id);
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, z: highest + 1 } : item)));
  };
  const moveWindow = (id: WindowId, left: string, top: string) => {
    setWindows((current) => current.map((item) => (item.id === id ? { ...item, left, top } : item)));
  };

  const handleContinueToNextDay = async () => {
    if (settlement?.is_final_day) {
      setGameOver({ finalDay: settlement.day });
      setSettlement(null);
      return;
    }
    setSettlement(null);
    settledForCurrentDay.current = false;
    await advanceDay();
  };

  return (
    <main className="desktop" onClick={() => setOpenMenu(null)}>
      <header className="menubar" onClick={(event) => event.stopPropagation()}>
        <button type="button" className={`apple-button ${openMenu === 'Apple' ? 'apple-button--open' : ''}`} aria-label="Apple menu" aria-haspopup="menu" aria-expanded={openMenu === 'Apple'} onClick={() => setOpenMenu(openMenu === 'Apple' ? null : 'Apple')}></button>
        <nav className="menu-links" aria-label="Main menu">
          {menuItems.map((item) => <button type="button" key={item} className="menu-link" onClick={() => setOpenMenu(null)}>{item}</button>)}
        </nav>
        <div className="menubar-spacer" />
        {settling && <span className="menubar-status">正在结算今日工作...</span>}
        <span className="menubar-time">{time}</span>
      </header>

      {openMenu === 'Apple' && (
        <div className="dropdown-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          {['About This Macintosh', 'Control Panels', 'Key Caps', 'Shut Down...'].map((entry) => <button type="button" role="menuitem" key={entry} onClick={() => { if (entry === 'About This Macintosh') openWindow('about'); setOpenMenu(null); }}>{entry}</button>)}
        </div>
      )}

      <div className="desktop-icons" aria-label="Desktop applications">
        <button className="desktop-icon desktop-icon--notes" onDoubleClick={() => openWindow('notes')}><Icon type="note" /><span>{APP_NAMES.notes}</span></button>
        <button className="desktop-icon desktop-icon--email" onDoubleClick={() => openWindow('email')}><Icon type="email" /><span>{APP_NAMES.email}</span></button>
        <button className="desktop-icon desktop-icon--archives" onDoubleClick={() => openWindow('archives')}><Icon type="archive" /><span>{APP_NAMES.archives}</span></button>
        <button className="desktop-icon desktop-icon--medical" onDoubleClick={() => openWindow('medical')}><Icon type="medical" /><span>{APP_NAMES.medical}</span></button>
        <button className="desktop-icon desktop-icon--chat" onDoubleClick={() => openWindow('chat')}><Icon type="chat" /><span>{APP_NAMES.chat}</span></button>
        <button className="desktop-icon desktop-icon--trash" onDoubleClick={() => openWindow('trash')}><Icon type="trash" /><span>Trash</span></button>
      </div>

      {visibleWindows.map((windowState) => (
        <WindowChrome key={windowState.id} window={windowState} active={activeWindow === windowState.id} onClose={() => closeWindow(windowState.id)} onFocus={() => focusWindow(windowState.id)} onMove={(left, top) => moveWindow(windowState.id, left, top)}>
          {windowState.id === 'archives' && <ArchiveApp />}
          {windowState.id === 'email' && <EmailApp />}
          {windowState.id === 'medical' && <MedicalApp />}
          {windowState.id === 'chat' && <ChatApp />}
          {windowState.id === 'about' && <div className="about-window"><Icon type="mac" /><h1>赛博水浒入职日</h1><p className="version">System Software 7.5.5</p><div className="about-rule" /><p className="copyright">Copyright © 1996</p><button className="default-button" onClick={() => closeWindow('about')}>OK</button></div>}
          {windowState.id === 'notes' && <div className="notes-window"><p className="notes-heading">欢迎来到人事审查系统。</p><p>双击图标打开对应软件：邮箱、档案、医疗库、聊天。</p><p className="notes-signoff">- 系统管理员</p></div>}
          {windowState.id === 'trash' && <div className="trash-window"><Icon type="trash" /><p>Trash is empty.</p><button className="default-button" onClick={() => closeWindow('trash')}>Close</button></div>}
        </WindowChrome>
      ))}

      {settlement && (
        <SettlementModal result={settlement} onClose={handleContinueToNextDay} />
      )}

      {gameOver && <GameOverModal finalDay={gameOver.finalDay} />}

      <footer className="desktop-footer"><span>Connected to LOCALNET • 1996</span></footer>
    </main>
  );
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginName, setLoginName] = useState('guest');
  const [loginPassword, setLoginPassword] = useState('');

  const submitLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    window.setTimeout(() => {
      setIsLoggedIn(true);
      setIsLoggingIn(false);
    }, 460);
  };

  if (!isLoggedIn) {
    return (
      <main className={`desktop login-desktop ${isLoggingIn ? 'login-desktop--leaving' : ''}`}>
        <div className="login-statusline"><span>AppleTalk Network</span><span>System Software 7.5.5</span></div>
        <section className="login-dialog" aria-labelledby="login-title">
          <div className="login-titlebar"><span id="login-title">Welcome</span></div>
          <div className="login-body">
            <div className="login-intro"><Icon type="mac" /><div><h1>Welcome</h1><p>Enter your name to begin.</p></div></div>
            <form className="login-form" onSubmit={submitLogin}>
              <label htmlFor="login-name">Name<input id="login-name" value={loginName} onChange={(event) => setLoginName(event.target.value)} autoFocus autoComplete="username" /></label>
              <label htmlFor="login-password">Password<input id="login-password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} autoComplete="current-password" /></label>
              <button className="login-button" type="submit" disabled={isLoggingIn}>{isLoggingIn ? 'Opening...' : 'Log In'}</button>
            </form>
            <div className="login-footer"><span>Guest Access</span><span>{loginName || 'guest'}@LOCALNET</span></div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <GameProvider>
      <DesktopShell />
    </GameProvider>
  );
}
