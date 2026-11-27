'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import StatTiles from '@/components/ui/StatTiles';
import SegTabs from '@/components/ui/SegTabs';
import { fetchTeamOnboarding, getUploadUrl, finalizeDocumentUpload } from '@/app/actions/documents';
import st from './onboarding.module.css';

const WORD = { missing: 'Not uploaded', rejected: 'Rejected', pending_review: 'In review', approved: 'Approved' };
const ACCOUNT = { active: 'Active', invited: 'Invited, not joined yet', pending_approval: 'Waiting for approval', pending_licensing: 'Pending licensing', docs_pending_review: 'Documents in review' };
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

export default function TeamOnboardingPage() {
  const [state, setState] = useState({ loading: true });
  const [filter, setFilter] = useState('todo');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [upload, setUpload] = useState(null);   // { person, item, file, progress, busy, error }
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const r = await fetchTeamOnboarding();
    setState(r.success ? { people: r.people, scope: r.scope } : { error: r.error === 'Unauthorized' ? 'Only owners, admins and team leaders can open this screen.' : r.error });
  }, []);
  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => state.people || [], [state.people]);
  const counts = useMemo(() => ({
    all: people.length,
    todo: people.filter(p => p.toUpload > 0).length,
    review: people.filter(p => p.toUpload === 0 && !p.complete).length,
    done: people.filter(p => p.complete).length,
    noCard: people.filter(p => !p.hasCard && !p.cardExempt).length,
  }), [people]);
  const shown = people.filter(p => (filter === 'all' || (filter === 'todo' && p.toUpload > 0) || (filter === 'review' && p.toUpload === 0 && !p.complete) || (filter === 'done' && p.complete))
    && (!search.trim() || `${p.name} ${p.email}`.toLowerCase().includes(search.trim().toLowerCase())));

  const startUpload = (person, item) => { setUpload({ person, item, file: null, progress: 0, busy: false, error: '' }); };
  const pick = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const error = !ALLOWED.includes(file.type) ? 'Only PDF, JPG and PNG files are accepted.' : file.size > 20 * 1024 * 1024 ? 'The file is larger than 20 MB.' : '';
    setUpload(u => ({ ...u, file, error }));
  };
  const send = async () => {
    const { person, item, file } = upload; if (!file) return;
    setUpload(u => ({ ...u, busy: true, error: '', progress: 0 }));
    try {
      const urlRes = await getUploadUrl({ docType: item.uploadType, fileName: file.name, contentType: file.type, size: file.size, targetAgentId: person.id });
      if (!urlRes.success) throw new Error(urlRes.error);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUpload(u => (u ? { ...u, progress: Math.round((ev.loaded / ev.total) * 100) } : u)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload failed (HTTP ${xhr.status}).`)));
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.open('PUT', urlRes.uploadUrl); xhr.setRequestHeader('Content-Type', file.type); xhr.send(file);
      });
      const fin = await finalizeDocumentUpload({ docType: item.uploadType, storagePath: urlRes.storagePath, fileName: file.name, size: file.size, targetAgentId: person.id });
      if (!fin.success) throw new Error(fin.error);
      setUpload(null); await load();
    } catch (err) {
      setUpload(u => (u ? { ...u, busy: false, error: err.message || 'The upload failed.' } : u));
    }
  };

  if (state.loading) return <div className={st.page}><PageHeader title="Team Onboarding" subtitle="Loading" /></div>;
  if (state.error) return <div className={st.page}><PageHeader title="Team Onboarding" subtitle={state.error} /></div>;

  return (
    <div className={st.page}>
      <PageHeader title="Team Onboarding" subtitle={state.scope === 'downline' ? 'Everyone below you in the hierarchy, and what each still owes.' : 'Every agent in the agency, and what each still owes.'} />

      <StatTiles items={[
        { label: 'Still uploading documents', value: counts.todo, onClick: () => setFilter('todo'), active: filter === 'todo' },
        { label: 'Waiting for review', value: counts.review, tone: counts.review > 0 ? 'amber' : undefined, onClick: () => setFilter('review'), active: filter === 'review' },
        { label: 'Onboarding complete', value: counts.done, tone: 'good', onClick: () => setFilter('done'), active: filter === 'done' },
        { label: 'No card on file', value: counts.noCard, tone: counts.noCard > 0 ? 'warn' : undefined },
      ]} />

      <div className={st.bar}>
        <SegTabs label="Show" value={filter} onChange={setFilter} tabs={[{ key: 'todo', label: 'To upload', count: counts.todo }, { key: 'review', label: 'In review', count: counts.review }, { key: 'done', label: 'Complete', count: counts.done }, { key: 'all', label: 'Everyone', count: counts.all }]} />
        <input type="search" className={st.search} placeholder="Search by name or email" aria-label="Search people" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <div className={st.empty}><b>Nobody here</b><span>{search ? 'No one matches that search.' : 'No one is in this group right now.'}</span></div>
      ) : (
        <ul className={st.list}>
          {shown.map((p, i) => {
            const isOpen = open === p.id; const pct = Math.round((p.uploaded / p.total) * 100);
            return (
              <li key={p.id} className={st.person} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <button type="button" className={st.row} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                  <span className={st.who}><b>{p.name}</b><small>{ACCOUNT[p.status] || p.status}{p.uplineName ? `, under ${p.uplineName}` : ''}</small></span>
                  <span className={st.meter}><span><i style={{ width: `${pct}%` }} /></span><small>{p.uploaded} of {p.total} uploaded, {p.approved} approved</small></span>
                  <span className={st.tags}>
                    <em data-tone={p.complete ? 'good' : p.toUpload > 0 ? 'todo' : 'wait'}>{p.complete ? 'Onboarding complete' : p.toUpload > 0 ? `${p.toUpload} to upload` : 'In review'}</em>
                    {!p.hasCard && !p.cardExempt && <em data-tone="bad">No card</em>}
                  </span>
                  <span className={st.chev} aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className={st.detail}>
                    <ul className={st.docs}>
                      {p.items.map(item => (
                        <li key={item.key} data-status={item.status}>
                          <span className={st.dot} aria-hidden="true" />
                          <span className={st.docName}>{item.label}</span>
                          <span className={st.docState}>{WORD[item.status]}</span>
                          {(item.status === 'missing' || item.status === 'rejected')
                            ? <button type="button" className={st.small} onClick={() => startUpload(p, item)}>Upload for them</button>
                            : <span />}
                        </li>
                      ))}
                    </ul>
                    <div className={st.links}>
                      <Link href={`/dashboard/team/${p.id}`} className={st.link}>Open their profile</Link>
                      <Link href="/dashboard/admin/documents" className={st.link}>Review documents</Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {upload && (
        <div className={st.overlay} role="dialog" aria-modal="true" aria-labelledby="up-title" onClick={e => { if (e.target === e.currentTarget && !upload.busy) setUpload(null); }}>
          <div className={st.dialog}>
            <h2 id="up-title" className={st.dTitle}>Upload {upload.item.label}</h2>
            <p className={st.dText}>For {upload.person.name}. PDF, JPG or PNG, up to 20 MB. It will show as &ldquo;In review&rdquo; until it is approved.</p>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={pick} disabled={upload.busy} className={st.file} />
            {upload.busy && <div className={st.progress}><i style={{ width: `${upload.progress}%` }} /></div>}
            {upload.error && <p className={st.err} role="alert">{upload.error}</p>}
            <div className={st.dBtns}>
              <button type="button" className={st.primary} onClick={send} disabled={!upload.file || !!upload.error || upload.busy}>{upload.busy ? `Uploading ${upload.progress}%` : 'Upload document'}</button>
              <button type="button" className={st.ghost} onClick={() => setUpload(null)} disabled={upload.busy}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
