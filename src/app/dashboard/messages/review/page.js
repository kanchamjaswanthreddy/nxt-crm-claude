'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import SegTabs from '@/components/ui/SegTabs';
import Modal from '@/components/ui/Modal';
import BackLink from '@/components/ui/BackLink';
import { useToast } from '@/components/ui/Toast';
import { reviewAccess, reviewConversations, reviewOpen, reviewFileUrl, reviewLog, saveReviewSettings } from '@/app/actions/messageReview';
import s from './review.module.css';

const KIND = { direct: 'Direct message', group: 'Group chat', agency: 'Everyone channel', team: 'Team channel' };
const when = (isoStr) => (isoStr ? new Date(isoStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

export default function MessageReviewPage() {
  const toast = useToast();
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState('chats');
  const [convs, setConvs] = useState(null);
  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  const [find, setFind] = useState('');
  const [log, setLog] = useState(null);
  const [years, setYears] = useState(7);
  const [second, setSecond] = useState('');

  const loadAccess = useCallback(() => reviewAccess().then(r => { if (r.success) { setAccess(r); if (r.allowed) { setYears(r.retentionYears); setSecond(r.reviewer?.id || ''); } } else setAccess({ allowed: false }); }), []);
  useEffect(() => { loadAccess(); }, [loadAccess]);
  useEffect(() => {
    if (!access?.allowed) return;
    if (tab === 'chats' && convs === null) reviewConversations().then(r => setConvs(r.success ? r.conversations : []));
    if (tab === 'log') reviewLog().then(r => setLog(r.success ? r.entries : []));
  }, [access, tab, convs]);

  const openChat = async () => {
    setBusy(true);
    const r = await reviewOpen(asking.id, reason);
    setBusy(false);
    if (!r.success) { toast.error(r.error); return; }
    setOpen({ ...r, id: asking.id }); setAsking(null); setReason(''); setFind('');
  };
  const openFile = async (m) => {
    const r = await reviewFileUrl(open.id, m.id, m.archiveId);
    if (!r.success) { toast.error(r.error); return; }
    window.open(r.url, '_blank', 'noopener');
  };
  const save = async (change, done) => {
    setBusy(true);
    const r = await saveReviewSettings(change);
    setBusy(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success(done); loadAccess();
  };

  if (access === null) return <p className={s.muted}>Loading…</p>;
  if (!access.allowed) {
    return (
      <div>
        <BackLink href="/dashboard/messages">Messages</BackLink>
        <PageHeader title="Message review" subtitle="Only the agency owner and the compliance reviewer the owner names can open this screen." />
      </div>
    );
  }

  if (open) {
    const needle = find.trim().toLowerCase();
    const shown = open.messages.filter(m => !needle || `${m.text} ${m.authorName} ${m.file?.name || ''} ${m.earlier.map(e => e.text).join(' ')}`.toLowerCase().includes(needle));
    return (
      <div className={s.sheet}>
        <div className={s.noPrint}><button type="button" className="nxt-back" onClick={() => setOpen(null)}>All conversations</button></div>
        <PageHeader title={open.title} subtitle={`${KIND[open.type]}${open.members.length ? ` · ${open.members.join(', ')}` : ''}`}
          actions={<button type="button" className={`nxt-btn ${s.noPrint}`} onClick={() => window.print()}>Print or save as PDF</button>} />
        <p className={s.stamp}>Read-only compliance review. Opened by {open.reviewerName} on {when(open.openedAt)}. Reason: {open.reason}</p>
        <input className={`${s.input} ${s.noPrint}`} placeholder="Find in this conversation" value={find} onChange={e => setFind(e.target.value)} aria-label="Find in this conversation" />
        <ol className={s.thread}>
          {shown.map(m => (
            <li key={m.archiveId || m.id} className={m.deletedAt ? s.deleted : ''}>
              <div className={s.line}><strong>{m.authorName}</strong><span>{when(m.at)}</span>{m.deletedAt && <em className={s.tag}>Deleted by sender {when(m.deletedAt)}</em>}{!m.deletedAt && m.earlier.length > 0 && <em className={s.tag}>Edited</em>}</div>
              {m.replyTo && <p className={s.quote}>In reply to {m.replyTo.authorName}: {m.replyTo.text}</p>}
              {m.text && <p className={s.text}>{m.text}</p>}
              {m.file && <button type="button" className={s.link} onClick={() => openFile(m)}>File: {m.file.name}</button>}
              {m.card && <p className={s.quote}>Shared {m.card.type}: {m.card.name}</p>}
              {m.earlier.map((e, i) => <p key={i} className={s.earlier}>Earlier wording, changed {when(e.at)}: {e.text}</p>)}
            </li>
          ))}
          {!shown.length && <li className={s.muted}>{needle ? 'Nothing matches.' : 'No messages in this conversation.'}</li>}
        </ol>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const list = (convs || []).filter(c => !needle || `${c.title} ${c.members.join(' ')}`.toLowerCase().includes(needle));
  const tabs = [{ key: 'chats', label: 'Conversations' }, { key: 'log', label: 'Access log' }, ...(access.isOwner ? [{ key: 'settings', label: 'Settings' }] : [])];

  return (
    <div>
      <BackLink href="/dashboard/messages">Messages</BackLink>
      <PageHeader title="Message review" subtitle="Read-only access for compliance. Every conversation you open is recorded with your name, the time and your reason." />
      <SegTabs label="Message review sections" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'chats' && (
        <div className={s.block}>
          <input className={s.input} placeholder="Find by person or group name" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a conversation" />
          <ul className={s.rows}>
            {convs === null && <li className={s.muted}>Loading conversations…</li>}
            {list.map(c => (
              <li key={c.id} className={s.rowItem}>
                <div className={s.rowText}><strong>{c.title}</strong><span>{KIND[c.type]}{c.type === 'group' ? ` · ${c.members.join(', ')}` : ''} · last message {when(c.lastAt)}</span></div>
                <button type="button" className="nxt-btn nxt-btn-sm" onClick={() => { setAsking(c); setReason(''); }}>Open for review</button>
              </li>
            ))}
            {convs && !list.length && <li className={s.muted}>{needle ? 'No conversations match.' : 'No conversations have messages yet.'}</li>}
          </ul>
        </div>
      )}

      {tab === 'log' && (
        <div className={s.block}>
          <p className={s.muted}>This record cannot be edited or deleted by anyone.</p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th>When</th><th>Who</th><th>Conversation</th><th>Reason</th></tr></thead>
              <tbody>
                {(log || []).map(e => <tr key={e.id}><td>{when(e.at)}</td><td>{e.reviewerName}</td><td>{e.kind === 'settings' ? 'Settings change' : e.conversationTitle}</td><td>{e.reason}</td></tr>)}
                {log && !log.length && <tr><td colSpan={4}>No conversation has been opened for review yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && access.isOwner && (
        <div className={s.block}>
          <section className={s.setting}>
            <h2>Second reviewer</h2>
            <p className={s.muted}>You can give one more person the same read-only review access. Their access is logged the same way as yours.</p>
            <div className={s.inline}>
              <select className={s.input} value={second} onChange={e => setSecond(e.target.value)} aria-label="Second reviewer"><option value="">No second reviewer</option>{access.people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <button type="button" className="nxt-btn nxt-btn-primary" disabled={busy || second === (access.reviewer?.id || '')} onClick={() => save({ reviewerId: second }, second ? 'Reviewer saved' : 'Second reviewer removed')}>Save reviewer</button>
            </div>
          </section>
          <section className={s.setting}>
            <h2>How long deleted and edited messages are kept</h2>
            <p className={s.muted}>After this time the kept copies and their files are cleared automatically. Confirm the period NXT needs with your carriers or compliance adviser.</p>
            <div className={s.inline}>
              <select className={s.input} value={years} onChange={e => setYears(Number(e.target.value))} aria-label="Years to keep">{[1, 2, 3, 5, 6, 7, 10].map(y => <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>)}</select>
              <button type="button" className="nxt-btn nxt-btn-primary" disabled={busy || years === access.retentionYears} onClick={() => save({ retentionYears: years }, 'Retention period saved')}>Save period</button>
            </div>
          </section>
        </div>
      )}

      <Modal isOpen={!!asking} onClose={() => setAsking(null)} title="Why are you opening this conversation?" size="sm"
        footer={<div className="nxt-actions"><button type="button" className="nxt-btn" onClick={() => setAsking(null)}>Cancel</button><button type="button" className="nxt-btn nxt-btn-primary" disabled={busy || reason.trim().length < 10} onClick={openChat}>Record reason and open</button></div>}>
        <p className={s.muted}><strong>{asking?.title}</strong>. Your name, the time and this reason are saved to the access log and cannot be removed.</p>
        <textarea className={s.area} rows={3} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: client complaint on policy 12345" aria-label="Reason for review" />
      </Modal>
    </div>
  );
}
