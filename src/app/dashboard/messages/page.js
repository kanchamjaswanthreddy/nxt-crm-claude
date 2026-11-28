'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { getDisplayName } from '@/lib/constants';
import { fetchAgentDirectory } from '@/app/actions/directory';
import { searchRecords } from '@/app/actions/calendar';
import {
  listConversations, startDirect, createGroup, updateGroup, fetchMessages, sendMessage, editMessage, deleteMessage,
  toggleReaction, getChatUploadUrl, getChatFileUrl, searchMessages,
} from '@/app/actions/messages';
import s from './messages.module.css';

const REACTIONS = ['👍', '❤️', '😂', '🎉', '✅', '🙏'];
const RECORD = { lead: { label: 'Lead', href: (id) => `/dashboard/leads/${id}` }, client: { label: 'Client', href: (id) => `/dashboard/clients/${id}` }, deal: { label: 'Deal', href: (id) => `/dashboard/deals/${id}` } };
const MAX_FILE = 25 * 1024 * 1024;

const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const timeOf = (isoStr) => new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function dayLabel(isoStr) {
  const d = new Date(isoStr); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}
function listTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return sameDay(d, new Date()) ? timeOf(isoStr) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
const sizeText = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function PeoplePicker({ people, chosen, onToggle, single }) {
  const [q, setQ] = useState('');
  const shown = people.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div>
      <input className={s.input} placeholder="Search people by name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search people" />
      <ul className={s.people}>
        {shown.map(p => (
          <li key={p.id}>
            <button type="button" className={`${s.person} ${chosen.includes(p.id) ? s.personOn : ''}`} onClick={() => onToggle(p.id)}>
              <span className={s.avatar} aria-hidden="true">{initials(p.name)}</span>
              <span className={s.personName}>{p.name}</span>
              {!single && <span className={s.tick} aria-hidden="true">{chosen.includes(p.id) ? '✓' : ''}</span>}
            </button>
          </li>
        ))}
        {!shown.length && <li className={s.muted}>No one matches that name.</li>}
      </ul>
    </div>
  );
}

export default function MessagesPage() {
  const toast = useToast();
  const [me, setMe] = useState('');
  const [convs, setConvs] = useState(null);
  const [people, setPeople] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [seenAt, setSeenAt] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState('');
  const [menuFor, setMenuFor] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newMode, setNewMode] = useState('direct');
  const [groupName, setGroupName] = useState('');
  const [picked, setPicked] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [rename, setRename] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareType, setShareType] = useState('lead');
  const [shareQ, setShareQ] = useState('');
  const [shareRows, setShareRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState({ years: 7, canReview: false });

  const scroller = useRef(null); const fileInput = useRef(null); const box = useRef(null);
  const stamp = useRef({ last: null, changed: null, id: '' });

  const nameById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p.name])), [people]);
  const titleOf = useCallback((c) => {
    if (!c) return '';
    if (c.type === 'direct') return nameById[c.memberIds.find(x => x !== me)] || 'Direct message';
    return c.name || 'Group';
  }, [nameById, me]);
  const active = useMemo(() => (convs || []).find(c => c.id === activeId) || null, [convs, activeId]);

  const loadList = useCallback(async () => {
    const r = await listConversations();
    if (!r.success) return;
    setMe(r.me); setConvs(r.conversations); setPolicy({ years: r.retentionYears, canReview: r.canReview });
    window.dispatchEvent(new CustomEvent('nxt-unread-chats', { detail: r.conversations.filter(c => c.unread && c.id !== stamp.current.id).length }));
  }, []);

  useEffect(() => {
    loadList();
    fetchAgentDirectory().then(r => { if (r.success) setPeople(r.agents.filter(a => a.status !== 'terminated').map(a => ({ id: a.id, name: getDisplayName(a) || a.email || 'Team member' })).sort((a, b) => a.name.localeCompare(b.name))); });
    const wanted = new URLSearchParams(window.location.search).get('c');
    if (wanted) setActiveId(wanted);
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadList(); }, 15000);
    return () => clearInterval(t);
  }, [loadList]);

  const toBottom = () => requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; });

  const loadChat = useCallback(async (id, quiet) => {
    if (!quiet) setLoadingChat(true);
    const r = await fetchMessages(id);
    if (stamp.current.id !== id) return;
    setLoadingChat(false);
    if (!r.success) { if (!quiet) toast.error(r.error); return; }
    setMessages(r.messages); setSeenAt(r.seenAt);
    stamp.current.last = r.messages.length ? r.messages[r.messages.length - 1].at : null; stamp.current.changed = r.changedAt;
    if (!quiet) toBottom();
  }, [toast]);

  // Open a chat, then keep it fresh: new messages every few seconds, a full reload when something was edited, deleted or reacted to.
  useEffect(() => {
    stamp.current = { last: null, changed: null, id: activeId };
    setMessages([]); setReplyTo(null); setEditing(null); setDraft(''); setMenuFor(''); setSeenAt(null);
    if (!activeId) return undefined;
    loadChat(activeId).then(loadList);
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const id = activeId; const r = await fetchMessages(id, stamp.current.last || undefined);
      if (!r.success || stamp.current.id !== id) return;
      setSeenAt(r.seenAt);
      if ((r.changedAt || null) !== (stamp.current.changed || null)) { loadChat(id, true); return; }
      if (stamp.current.last && r.messages.length) {
        const el = scroller.current; const nearEnd = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 160 : true;
        setMessages(prev => { const have = new Set(prev.map(m => m.id)); return [...prev, ...r.messages.filter(m => !have.has(m.id))]; });
        stamp.current.last = r.messages[r.messages.length - 1].at;
        if (nearEnd) toBottom();
      } else if (!stamp.current.last && r.messages.length) loadChat(id, true);
    }, 4000);
    return () => clearInterval(t);
  }, [activeId, loadChat, loadList]);

  const send = async (extra) => {
    if (!activeId || sending) return;
    const body = draft.trim();
    if (editing) {
      setSending(true);
      const r = await editMessage(activeId, editing.id, body);
      setSending(false);
      if (!r.success) { toast.error(r.error); return; }
      setEditing(null); setDraft(''); loadChat(activeId, true); return;
    }
    if (!body && !extra) return;
    setSending(true);
    const r = await sendMessage(activeId, { text: body, replyTo: replyTo?.id, ...(extra || {}) });
    setSending(false);
    if (!r.success) { toast.error(r.error); return; }
    setMessages(prev => [...prev, r.message]); stamp.current.last = r.message.at;
    setDraft(''); setReplyTo(null); toBottom(); loadList(); box.current?.focus();
  };

  const attach = async (file) => {
    if (!file || !activeId) return;
    if (file.size > MAX_FILE) { toast.error('File too large. Maximum 25 MB.'); return; }
    setUploading(file.name);
    try {
      const u = await getChatUploadUrl(activeId, { fileName: file.name, contentType: file.type, size: file.size });
      if (!u.success) { toast.error(u.error); return; }
      const put = await fetch(u.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) { toast.error('The file could not be uploaded. Please try again.'); return; }
      await send({ file: { path: u.path, name: file.name } });
    } catch { toast.error('The file could not be uploaded. Please try again.'); }
    finally { setUploading(''); if (fileInput.current) fileInput.current.value = ''; }
  };

  const openFile = async (m) => {
    const r = await getChatFileUrl(activeId, m.id);
    if (!r.success) { toast.error(r.error); return; }
    window.open(r.url, '_blank', 'noopener');
  };

  const react = async (m, emoji) => {
    setMenuFor('');
    setMessages(prev => prev.map(x => {
      if (x.id !== m.id) return x;
      const cur = x.reactions.find(r => r.emoji === emoji);
      const reactions = cur ? x.reactions.map(r => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)).filter(r => r.count > 0) : [...x.reactions, { emoji, count: 1, mine: true }];
      return { ...x, reactions };
    }));
    const r = await toggleReaction(activeId, m.id, emoji);
    if (!r.success) { toast.error(r.error); loadChat(activeId, true); }
  };

  const removeMessage = async () => {
    const m = confirmDelete; setBusy(true);
    const r = await deleteMessage(activeId, m.id);
    setBusy(false); setConfirmDelete(null);
    if (!r.success) { toast.error(r.error); return; }
    setMessages(prev => prev.filter(x => x.id !== m.id)); toast.success('Message deleted'); loadList();
  };

  const openNew = (mode) => { setNewMode(mode); setPicked([]); setGroupName(''); setNewOpen(true); };
  const startChat = async (ids) => {
    setBusy(true);
    const r = newMode === 'direct' ? await startDirect(ids[0]) : await createGroup(groupName, ids);
    setBusy(false);
    if (!r.success) { toast.error(r.error); return; }
    setNewOpen(false); await loadList(); setActiveId(r.id);
  };

  const saveGroup = async (change) => {
    setBusy(true);
    const r = await updateGroup(activeId, change);
    setBusy(false);
    if (!r.success) { toast.error(r.error); return; }
    if (r.left) { setInfoOpen(false); setActiveId(''); toast.success('You left the group'); } else toast.success('Group updated');
    setPicked([]); loadList();
  };

  useEffect(() => {
    if (!shareOpen) return undefined;
    const t = setTimeout(() => searchRecords(shareType, shareQ).then(r => setShareRows(r.success ? r.records || r.rows || [] : [])), 250);
    return () => clearTimeout(t);
  }, [shareOpen, shareType, shareQ]);

  useEffect(() => {
    const q = filter.trim();
    if (q.length < 2) { setFound(null); return undefined; }
    const t = setTimeout(() => searchMessages(q).then(r => setFound(r.success ? r.results : [])), 350);
    return () => clearTimeout(t);
  }, [filter]);

  const shownConvs = (convs || []).filter(c => !filter.trim() || titleOf(c).toLowerCase().includes(filter.trim().toLowerCase()));
  const others = people.filter(p => p.id !== me);
  const memberNames = active && (active.type === 'group' || active.type === 'direct') ? active.memberIds.map(id => (id === me ? 'You' : nameById[id] || 'Team member')) : [];
  const subtitle = !active ? '' : active.type === 'agency' ? 'Everyone in the agency' : active.type === 'team' ? 'The team head and everyone on the team' : active.type === 'group' ? `${active.memberIds.length} people` : 'Direct message';
  const lastMine = [...messages].reverse().find(m => m.mine);

  return (
    <div className={`${s.wrap} ${activeId ? s.chatOpen : ''}`}>
      <aside className={s.list} aria-label="Conversations">
        <div className={s.listHead}>
          <h1 data-plain className={s.title}>Messages</h1>
          <div className={s.headBtns}>
            <button type="button" className="nxt-btn nxt-btn-sm" onClick={() => openNew('group')}>New group</button>
            <button type="button" className="nxt-btn nxt-btn-primary nxt-btn-sm" onClick={() => openNew('direct')}>New message</button>
          </div>
        </div>
        <input className={s.input} placeholder="Search chats and messages" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Search chats and messages" />
        <ul className={s.convs}>
          {convs === null && <li className={s.muted}>Loading your chats…</li>}
          {shownConvs.map(c => (
            <li key={c.id}>
              <button type="button" className={`${s.conv} ${c.id === activeId ? s.convOn : ''}`} onClick={() => { setActiveId(c.id); setFound(null); }}>
                <span className={`${s.avatar} ${c.type !== 'direct' ? s.avatarGroup : ''}`} aria-hidden="true">{c.type === 'direct' ? initials(titleOf(c)) : c.type === 'agency' ? 'All' : initials(titleOf(c))}</span>
                <span className={s.convText}>
                  <span className={s.convTop}><span className={s.convName}>{titleOf(c)}</span><span className={s.convTime}>{listTime(c.lastAt)}</span></span>
                  <span className={s.convLast}>{c.lastText ? `${c.lastBy && c.type !== 'direct' ? `${c.lastBy.split(' ')[0]}: ` : ''}${c.lastText}` : 'No messages yet'}</span>
                </span>
                {c.unread && c.id !== activeId && <span className={s.dot} aria-label="Unread" />}
              </button>
            </li>
          ))}
          {convs && !shownConvs.length && !found?.length && <li className={s.muted}>No chats match.</li>}
          {found && found.length > 0 && <li className={s.foundHead}>In messages</li>}
          {found && found.map(f => (
            <li key={f.id}>
              <button type="button" className={s.conv} onClick={() => setActiveId(f.conversationId)}>
                <span className={s.convText}>
                  <span className={s.convTop}><span className={s.convName}>{titleOf((convs || []).find(c => c.id === f.conversationId))}</span><span className={s.convTime}>{listTime(f.at)}</span></span>
                  <span className={s.convLast}>{f.authorName.split(' ')[0]}: {f.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className={s.notice}>Messages may be reviewed by NXT compliance. Deleted and edited messages are kept for {policy.years} years for that purpose.{policy.canReview && <> <Link href="/dashboard/messages/review">Open message review</Link></>}</p>
      </aside>

      <section className={s.chat} aria-label="Conversation">
        {!active && (
          <div className={s.empty}>
            <p className={s.emptyTitle}>Pick a chat, or start one</p>
            <p className={s.muted}>Message anyone in the agency, share files, and start group chats. Admins and team heads cannot read your chats. Messages may be reviewed by NXT compliance when there is a recorded reason.</p>
            <button type="button" className="nxt-btn nxt-btn-primary" onClick={() => openNew('direct')}>New message</button>
          </div>
        )}
        {active && (
          <>
            <header className={s.chatHead}>
              <button type="button" className={`nxt-btn nxt-btn-sm ${s.backBtn}`} onClick={() => setActiveId('')}>Chats</button>
              <div className={s.chatTitle}>
                <strong>{titleOf(active)}</strong>
                <span>{subtitle}</span>
              </div>
              {active.type === 'group' && <button type="button" className="nxt-btn nxt-btn-sm" onClick={() => { setRename(active.name); setPicked([]); setInfoOpen(true); }}>Group details</button>}
            </header>

            <div className={s.stream} ref={scroller} onClick={() => setMenuFor('')}>
              {loadingChat && <p className={s.muted}>Loading messages…</p>}
              {!loadingChat && !messages.length && <p className={s.muted}>No messages yet. Say hello.</p>}
              {messages.map((m, i) => {
                const prev = messages[i - 1]; const newDay = !prev || !sameDay(prev.at, m.at);
                const showName = !m.mine && active.type !== 'direct' && (newDay || prev.authorId !== m.authorId);
                return (
                  <React.Fragment key={m.id}>
                    {newDay && <div className={s.day}><span>{dayLabel(m.at)}</span></div>}
                    <div className={`${s.row} ${m.mine ? s.mine : ''}`}>
                      <div className={s.bubbleWrap}>
                        {showName && <span className={s.author}>{m.authorName}</span>}
                        <div className={s.bubble}>
                          {m.replyTo && <div className={s.quote}><strong>{m.replyTo.authorName}</strong><span>{m.replyTo.text}</span></div>}
                          {m.text && <p className={s.text}>{m.text}</p>}
                          {m.file && (
                            <button type="button" className={s.file} onClick={() => openFile(m)}>
                              <span className={s.fileIcon} aria-hidden="true">{(m.file.name.split('.').pop() || 'file').slice(0, 4).toUpperCase()}</span>
                              <span className={s.fileText}><strong>{m.file.name}</strong><span>{sizeText(m.file.size)} · Download</span></span>
                            </button>
                          )}
                          {m.card && RECORD[m.card.type] && (
                            <Link href={RECORD[m.card.type].href(m.card.id)} className={s.card}>
                              <span>{RECORD[m.card.type].label}</span><strong>{m.card.name}</strong>
                            </Link>
                          )}
                          <span className={s.meta}>{timeOf(m.at)}{m.editedAt ? ' · edited' : ''}</span>
                        </div>
                        {m.reactions.length > 0 && (
                          <div className={s.reactions}>
                            {m.reactions.map(r => <button type="button" key={r.emoji} className={`${s.reaction} ${r.mine ? s.reactionOn : ''}`} onClick={() => react(m, r.emoji)} aria-label={`${r.emoji} ${r.count}`}>{r.emoji} {r.count}</button>)}
                          </div>
                        )}
                        {m.mine && lastMine?.id === m.id && seenAt && seenAt >= m.at && <span className={s.seen}>Seen</span>}
                      </div>
                      <div className={s.tools}>
                        <button type="button" className={s.tool} aria-label="Message options" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.id ? '' : m.id); }}>•••</button>
                        {menuFor === m.id && (
                          <div className={s.menu} onClick={e => e.stopPropagation()}>
                            <div className={s.menuReacts}>{REACTIONS.map(e => <button type="button" key={e} onClick={() => react(m, e)} aria-label={`React ${e}`}>{e}</button>)}</div>
                            <button type="button" onClick={() => { setReplyTo(m); setEditing(null); setMenuFor(''); box.current?.focus(); }}>Reply</button>
                            {m.mine && m.text && <button type="button" onClick={() => { setEditing(m); setReplyTo(null); setDraft(m.text); setMenuFor(''); box.current?.focus(); }}>Edit</button>}
                            {m.mine && <button type="button" className={s.menuDanger} onClick={() => { setConfirmDelete(m); setMenuFor(''); }}>Delete</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <footer className={s.composer}>
              {(replyTo || editing) && (
                <div className={s.context}>
                  <span>{editing ? 'Editing your message' : <>Replying to <strong>{replyTo.authorName}</strong>: {(replyTo.text || replyTo.file?.name || '').slice(0, 80)}</>}</span>
                  <button type="button" className={s.tool} onClick={() => { setReplyTo(null); if (editing) { setEditing(null); setDraft(''); } }} aria-label="Cancel">✕</button>
                </div>
              )}
              {uploading && <div className={s.context}><span>Uploading {uploading}…</span></div>}
              <div className={s.compRow}>
                <input ref={fileInput} type="file" hidden onChange={e => attach(e.target.files?.[0])} accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                <button type="button" className="nxt-btn nxt-btn-sm" onClick={() => fileInput.current?.click()} disabled={!!uploading || !!editing}>Attach file</button>
                <button type="button" className="nxt-btn nxt-btn-sm" onClick={() => { setShareQ(''); setShareOpen(true); }} disabled={!!editing}>Share record</button>
                <textarea ref={box} className={s.box} rows={1} maxLength={4000} placeholder={`Message ${titleOf(active)}`} value={draft} aria-label="Write a message"
                  onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button type="button" className="nxt-btn nxt-btn-primary nxt-btn-sm" onClick={() => send()} disabled={sending || !draft.trim()}>{editing ? 'Save' : 'Send'}</button>
              </div>
            </footer>
          </>
        )}
      </section>

      <Modal isOpen={newOpen} onClose={() => setNewOpen(false)} title={newMode === 'direct' ? 'New message' : 'New group chat'} size="sm"
        footer={newMode === 'group' ? <div className="nxt-actions"><button type="button" className="nxt-btn" onClick={() => setNewOpen(false)}>Cancel</button><button type="button" className="nxt-btn nxt-btn-primary" disabled={busy || !groupName.trim() || !picked.length} onClick={() => startChat(picked)}>Create group</button></div> : null}>
        {newMode === 'group' && <><label className={s.label} htmlFor="gname">Group name</label><input id="gname" className={s.input} value={groupName} maxLength={60} onChange={e => setGroupName(e.target.value)} placeholder="For example, Final Expense Team" /><p className={s.label}>Add people ({picked.length} chosen)</p></>}
        <PeoplePicker people={others} chosen={picked} single={newMode === 'direct'} onToggle={(id) => (newMode === 'direct' ? startChat([id]) : setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])))} />
      </Modal>

      <Modal isOpen={infoOpen} onClose={() => setInfoOpen(false)} title="Group details" size="sm">
        <label className={s.label} htmlFor="grename">Group name</label>
        <div className={s.inline}><input id="grename" className={s.input} value={rename} maxLength={60} onChange={e => setRename(e.target.value)} /><button type="button" className="nxt-btn nxt-btn-sm" disabled={busy || !rename.trim() || rename.trim() === active?.name} onClick={() => saveGroup({ name: rename })}>Rename</button></div>
        <p className={s.label}>In this group</p>
        <p className={s.members}>{memberNames.join(', ')}</p>
        <p className={s.label}>Add people</p>
        <PeoplePicker people={others.filter(p => !(active?.memberIds || []).includes(p.id))} chosen={picked} onToggle={(id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))} />
        <div className="nxt-actions" style={{ marginTop: 16 }}>
          <button type="button" className="nxt-btn nxt-btn-danger" disabled={busy} onClick={() => saveGroup({ leave: true })}>Leave group</button>
          <button type="button" className="nxt-btn nxt-btn-primary" disabled={busy || !picked.length} onClick={() => saveGroup({ add: picked })}>Add {picked.length || ''} to group</button>
        </div>
      </Modal>

      <Modal isOpen={shareOpen} onClose={() => setShareOpen(false)} title="Share a record" size="sm">
        <div className={s.inline}>
          <select className={s.input} value={shareType} onChange={e => setShareType(e.target.value)} aria-label="Record type"><option value="lead">Lead</option><option value="client">Client</option><option value="deal">Deal</option></select>
          <input className={s.input} placeholder="Search by name" value={shareQ} onChange={e => setShareQ(e.target.value)} aria-label="Search records" />
        </div>
        <ul className={s.people}>
          {shareRows.slice(0, 40).map(r => <li key={r.id}><button type="button" className={s.person} onClick={() => { setShareOpen(false); send({ card: { type: shareType, id: r.id } }); }}><span className={s.personName}>{r.name}</span></button></li>)}
          {!shareRows.length && <li className={s.muted}>Nothing found.</li>}
        </ul>
        <p className={s.muted}>The card shows the name only. People open the record only if they already have access to it.</p>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this message?" size="sm"
        footer={<div className="nxt-actions"><button type="button" className="nxt-btn" onClick={() => setConfirmDelete(null)}>Keep message</button><button type="button" className="nxt-btn nxt-btn-danger" disabled={busy} onClick={removeMessage}>Delete message</button></div>}>
        <p className={s.muted}>It is removed for everyone in the chat{confirmDelete?.file ? ', along with its file,' : ''} and cannot be brought back. A copy is kept for {policy.years} years for compliance review only.</p>
      </Modal>
    </div>
  );
}
