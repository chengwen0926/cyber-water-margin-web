'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type WindowId = 'archives' | 'email' | 'medical' | 'chat' | 'about' | 'notes' | 'trash';
type WindowState = { id: WindowId; title: string; left: string; top: string; width: string; height: string; z: number };
type Message = { from: 'me' | 'them'; text: string; time: string };

const APP_NAMES: Record<WindowId, string> = {
  archives: 'Archives',
  email: 'Email',
  medical: 'Medical',
  chat: 'Chat',
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
const archiveRecords = [
  { id: 'ARC-00041', title: 'North Wing Renovation', owner: 'Facilities', date: '08/12/96', status: 'Active' },
  { id: 'ARC-00038', title: 'Board Minutes - Q2', owner: 'Executive', date: '07/29/96', status: 'Restricted' },
  { id: 'ARC-00029', title: 'Research Correspondence', owner: 'Library', date: '06/14/96', status: 'Active' },
  { id: 'ARC-00017', title: 'Network Installation', owner: 'Systems', date: '05/03/96', status: 'Archived' },
  { id: 'ARC-00008', title: 'Personnel Handbook', owner: 'People Ops', date: '02/21/96', status: 'Archived' },
];
const mail = [
  { id: 1, from: 'Dana Foster', subject: 'Schedule for Friday', time: '9:32 AM', body: 'The updated Friday schedule is attached. Please review the two afternoon appointments before lunch.', unread: true },
  { id: 2, from: 'Systems Office', subject: 'Server maintenance', time: '8:10 AM', body: 'Archive services will be read-only from 11:00 PM until midnight during routine maintenance.', unread: true },
  { id: 3, from: 'M. Rivera', subject: 'Quarterly records', time: 'Yesterday', body: 'I finished indexing the quarterly records. They are ready for your final approval.', unread: false },
  { id: 4, from: 'Library Desk', subject: 'Document returned', time: 'Mon', body: 'The requested research volume has been returned and is available in the archive room.', unread: false },
];
const patients = [
  { id: 'P-1042', name: 'Alex Morgan', age: 42, room: '3A-12', status: 'Stable', allergy: 'Penicillin', note: 'Post-operative review. Mobility improving; continue current care plan.', pulse: 72, pressure: '118/76' },
  { id: 'P-1037', name: 'Jordan Lee', age: 35, room: '2B-04', status: 'Review', allergy: 'None known', note: 'Follow-up laboratory results available. Physician review requested.', pulse: 68, pressure: '122/80' },
  { id: 'P-1018', name: 'Sam Wilson', age: 61, room: '4C-09', status: 'Monitor', allergy: 'Sulfa drugs', note: 'Observation continues. Record vital signs every four hours.', pulse: 84, pressure: '130/84' },
  { id: 'P-0994', name: 'Casey Chen', age: 28, room: '1A-02', status: 'Stable', allergy: 'Latex', note: 'Discharge documents prepared. Awaiting final consultation.', pulse: 64, pressure: '116/72' },
];
const contacts = [
  { name: 'Dana Foster', initials: 'DF', status: 'Available' },
  { name: 'Systems Office', initials: 'SO', status: 'Available' },
  { name: 'M. Rivera', initials: 'MR', status: 'Away' },
];
const initialMessages: Message[] = [
  { from: 'them', text: 'Morning. Did the new archive index arrive?', time: '9:18' },
  { from: 'me', text: 'Yes, it is online now. I am checking the restricted files.', time: '9:20' },
  { from: 'them', text: 'Perfect. Send me the record number when you find it.', time: '9:21' },
];

function Icon({ type }: { type: string }) {
  return <span className={`pixel-icon pixel-icon--${type}`} aria-hidden="true"><span className="pixel-icon__detail" /></span>;
}

function WindowChrome({ window, active, onClose, onFocus, children }: { window: WindowState; active: boolean; onClose: () => void; onFocus: () => void; children: React.ReactNode }) {
  return (
    <section className={`mac-window ${active ? 'mac-window--active' : ''}`} style={{ left: window.left, top: window.top, width: window.width, height: window.height, zIndex: window.z }} onMouseDown={onFocus} aria-label={window.title}>
      <div className="window-titlebar" onDoubleClick={onFocus}>
        <button className="window-close" aria-label={`Close ${window.title}`} onClick={onClose} />
        <div className="window-titlebar__stripe" />
        <span className="window-title">{window.title}</span>
      </div>
      <div className="window-content">{children}</div>
    </section>
  );
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginName, setLoginName] = useState('guest');
  const [loginPassword, setLoginPassword] = useState('');
  const [windows, setWindows] = useState(initialWindows);
  const [activeWindow, setActiveWindow] = useState<WindowId>('archives');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [time, setTime] = useState('9:41 AM');
  const [archiveFilter, setArchiveFilter] = useState('All');
  const [selectedArchive, setSelectedArchive] = useState(archiveRecords[0].id);
  const [selectedMail, setSelectedMail] = useState(mail[0].id);
  const [selectedPatient, setSelectedPatient] = useState(patients[0].id);
  const [selectedContact, setSelectedContact] = useState(contacts[0].name);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date()));
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleWindows = useMemo(() => windows.filter((item) => item.z > 0), [windows]);
  const filteredArchives = archiveFilter === 'All' ? archiveRecords : archiveRecords.filter((record) => record.status === archiveFilter);
  const selectedMailItem = mail.find((item) => item.id === selectedMail) ?? mail[0];
  const selectedPatientItem = patients.find((item) => item.id === selectedPatient) ?? patients[0];

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
  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const sentAt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date());
    setMessages((current) => [...current, { from: 'me', text, time: sentAt }]);
    setDraft('');
  };

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
    <main className="desktop" onClick={() => setOpenMenu(null)}>
      <header className="menubar" onClick={(event) => event.stopPropagation()}>
        <button type="button" className={`apple-button ${openMenu === 'Apple' ? 'apple-button--open' : ''}`} aria-label="Apple menu" aria-haspopup="menu" aria-expanded={openMenu === 'Apple'} onClick={() => setOpenMenu(openMenu === 'Apple' ? null : 'Apple')}></button>
        <nav className="menu-links" aria-label="Main menu">
          {menuItems.map((item) => <button type="button" key={item} className="menu-link" onClick={() => setOpenMenu(null)}>{item}</button>)}
        </nav>
        <div className="menubar-spacer" />
        <span className="menubar-status"><span className="status-dot" /> Online</span>
        <span className="menubar-time">{time}</span>
      </header>

      {openMenu === 'Apple' && (
        <div className="dropdown-menu" role="menu" onClick={(event) => event.stopPropagation()}>
          {['About This Macintosh', 'Control Panels', 'Key Caps', 'Shut Down...'].map((entry) => <button type="button" role="menuitem" key={entry} onClick={() => { if (entry === 'About This Macintosh') openWindow('about'); setOpenMenu(null); }}>{entry}</button>)}
        </div>
      )}

      <div className="desktop-icons" aria-label="Desktop applications">
        <button className="desktop-icon desktop-icon--notes" onDoubleClick={() => openWindow('notes')}><Icon type="note" /><span>{APP_NAMES.notes}</span></button>
        <button className="desktop-icon desktop-icon--email" onDoubleClick={() => openWindow('email')}><span className="desktop-badge">2</span><Icon type="email" /><span>{APP_NAMES.email}</span></button>
        <button className="desktop-icon desktop-icon--archives" onDoubleClick={() => openWindow('archives')}><Icon type="archive" /><span>{APP_NAMES.archives}</span></button>
        <button className="desktop-icon desktop-icon--medical" onDoubleClick={() => openWindow('medical')}><Icon type="medical" /><span>{APP_NAMES.medical}</span></button>
        <button className="desktop-icon desktop-icon--chat" onDoubleClick={() => openWindow('chat')}><Icon type="chat" /><span>{APP_NAMES.chat}</span></button>
        <button className="desktop-icon desktop-icon--trash" onDoubleClick={() => openWindow('trash')}><Icon type="trash" /><span>{APP_NAMES.trash}</span></button>
      </div>

      {visibleWindows.map((window) => (
        <WindowChrome key={window.id} window={window} active={activeWindow === window.id} onClose={() => closeWindow(window.id)} onFocus={() => focusWindow(window.id)}>
          {window.id === 'archives' && (
            <div className="archive-app">
              <div className="app-toolbar"><div className="segmented-control" aria-label="Archive filter">{['All', 'Active', 'Restricted', 'Archived'].map((filter) => <button key={filter} className={archiveFilter === filter ? 'is-active' : ''} onClick={() => setArchiveFilter(filter)}>{filter}</button>)}</div><span className="app-counter">{filteredArchives.length} records</span></div>
              <div className="archive-head"><span>Record</span><span>Title</span><span>Owner</span><span>Modified</span></div>
              <div className="archive-list" role="listbox" aria-label="Archive records">{filteredArchives.map((record) => <button key={record.id} className={`archive-row ${selectedArchive === record.id ? 'is-selected' : ''}`} onClick={() => setSelectedArchive(record.id)}><span>{record.id}</span><strong>{record.title}</strong><span>{record.owner}</span><span>{record.date}</span></button>)}</div>
              <div className="app-statusbar"><span>INDEX V.4 • Secured volume</span><span>{selectedArchive}</span></div>
            </div>
          )}

          {window.id === 'email' && (
            <div className="mail-app">
              <aside className="mail-sidebar"><div className="mail-account"><Icon type="email" /><span><strong>{APP_NAMES.email}</strong><small>Connected</small></span></div>{['Inbox  2', 'Sent Mail', 'Drafts', 'Archive'].map((folder, index) => <button key={folder} className={index === 0 ? 'is-active' : ''}>{folder}</button>)}</aside>
              <section className="mail-main">
                <div className="mail-actions"><button>New Message</button><button>Reply</button><button>File...</button></div>
                <div className="mail-workspace"><div className="mail-list">{mail.map((item) => <button key={item.id} className={selectedMail === item.id ? 'is-selected' : ''} onClick={() => setSelectedMail(item.id)}><span className={`unread-dot ${item.unread ? 'is-unread' : ''}`} /><strong>{item.from}</strong><span>{item.subject}</span><time>{item.time}</time></button>)}</div><article className="mail-reader"><div className="mail-meta"><strong>{selectedMailItem.subject}</strong><span>From: {selectedMailItem.from}</span><span>To: You</span></div><p>{selectedMailItem.body}</p><p>Regards,<br />{selectedMailItem.from}</p></article></div>
                <div className="app-statusbar"><span>4 messages • 2 unread</span><span>Last checked just now</span></div>
              </section>
            </div>
          )}

          {window.id === 'medical' && (
            <div className="medical-app">
              <div className="medical-header"><Icon type="medical" /><span><strong>St. Claire Medical Center</strong><small>CLINICAL INFORMATION NETWORK</small></span><div className="medical-session"><span className="status-dot" /> Session secure</div></div>
              <div className="medical-body"><aside className="patient-list"><div className="section-label">CURRENT PATIENTS</div>{patients.map((patient) => <button key={patient.id} className={selectedPatient === patient.id ? 'is-selected' : ''} onClick={() => setSelectedPatient(patient.id)}><strong>{patient.name}</strong><span>{patient.id} • Room {patient.room}</span><em>{patient.status}</em></button>)}</aside><section className="patient-record"><div className="patient-title"><div><span className="patient-id">{selectedPatientItem.id}</span><h2>{selectedPatientItem.name}</h2><p>Age {selectedPatientItem.age} • Room {selectedPatientItem.room}</p></div><span className={`clinical-status clinical-status--${selectedPatientItem.status.toLowerCase()}`}>{selectedPatientItem.status}</span></div><div className="vitals-grid"><div><small>PULSE</small><strong>{selectedPatientItem.pulse}</strong><span>bpm</span></div><div><small>BLOOD PRESSURE</small><strong>{selectedPatientItem.pressure}</strong><span>mmHg</span></div><div><small>ALLERGIES</small><strong>{selectedPatientItem.allergy}</strong></div></div><div className="clinical-note"><span className="section-label">LATEST CLINICAL NOTE</span><p>{selectedPatientItem.note}</p><small>Updated today at 08:45 • D. Foster, MD</small></div><div className="record-actions"><button>Orders</button><button>Results</button><button>Full Chart</button></div></section></div>
            </div>
          )}

          {window.id === 'chat' && (
            <div className="chat-app">
              <aside className="chat-sidebar"><div className="chat-user"><span className="avatar avatar--self">YOU</span><span><strong>Local User</strong><small><span className="presence" /> Available</small></span></div><div className="section-label">CONTACTS</div>{contacts.map((contact) => <button key={contact.name} className={selectedContact === contact.name ? 'is-selected' : ''} onClick={() => setSelectedContact(contact.name)}><span className="avatar">{contact.initials}</span><span><strong>{contact.name}</strong><small><span className={`presence ${contact.status === 'Away' ? 'presence--away' : ''}`} /> {contact.status}</small></span></button>)}</aside>
              <section className="conversation"><header><span className="avatar">{contacts.find((contact) => contact.name === selectedContact)?.initials}</span><span><strong>{selectedContact}</strong><small>Direct connection • Encrypted</small></span></header><div className="message-list">{messages.map((message, index) => <div key={`${message.time}-${index}`} className={`message message--${message.from}`}><span>{message.text}</span><time>{message.time}</time></div>)}</div><form className="message-form" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message..." aria-label="Message" /><button type="submit">Send</button></form></section>
            </div>
          )}

          {window.id === 'about' && <div className="about-window"><Icon type="mac" /><h1>Macintosh</h1><p className="version">System Software 7.5.5</p><div className="memory-row"><span>Built-in Memory</span><strong>8,192K</strong></div><div className="about-rule" /><p className="copyright">Copyright © Apple Computer, Inc. 1984–1996</p><button className="default-button" onClick={() => closeWindow('about')}>OK</button></div>}
          {window.id === 'notes' && <div className="notes-window"><p className="notes-heading">Welcome to your Macintosh.</p><p>Double-click an application icon to open it. Click once to select.</p><p className="notes-signoff">- The Finder</p><div className="notes-status">{APP_NAMES.notes} • 142 words</div></div>}
          {window.id === 'trash' && <div className="trash-window"><Icon type="trash" /><p>Trash is empty.</p><button className="default-button" onClick={() => closeWindow('trash')}>Close</button></div>}
        </WindowChrome>
      ))}

      <footer className="desktop-footer"><span>Connected to LOCALNET • 1996</span></footer>
    </main>
  );
}
