'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchAgentDocuments } from '@/app/actions/deals-data';
import { computeDocChecklist } from '@/lib/documentTypes';
import s from './OnboardingDocsCard.module.css';

const WORD = { missing: 'Not uploaded', rejected: 'Upload again', pending_review: 'In review', approved: 'Approved' };

/** Dashboard card: which onboarding documents are still needed. Hidden for owners, admins and IT, and once everything is approved. */
export default function OnboardingDocsCard({ agent }) {
  const [docs, setDocs] = useState(null);
  const skip = !agent || agent.is_owner || agent.isOwner || ['admin', 'it_engineer'].includes(agent.role);
  useEffect(() => {
    if (skip) return undefined;
    let live = true;
    fetchAgentDocuments().then(r => { if (live && r.success) setDocs(r.documents); }).catch(() => {});
    return () => { live = false; };
  }, [skip]);

  if (skip || !docs) return null;
  const list = computeDocChecklist(agent, docs);
  if (list.complete) return null;
  const todo = list.items.filter(i => i.status === 'missing' || i.status === 'rejected');
  const pct = Math.round((list.uploaded / list.total) * 100);
  const waiting = todo.length === 0;

  return (
    <section className={s.card} aria-label="Onboarding documents">
      <Link href="/dashboard/business/documents" className={s.main}>
        <span className={s.ring} style={{ '--p': pct }} aria-hidden="true"><b>{list.uploaded}</b><small>of {list.total}</small></span>
        <span className={s.text}>
          <span className={s.badge} data-wait={waiting || undefined}>{waiting ? 'Documents in review' : 'Onboarding pending'}</span>
          <span className={s.title}>
            {waiting ? 'Everything is uploaded. We are reviewing your documents.' : `${todo.length} document${todo.length !== 1 ? 's' : ''} still to upload`}
          </span>
          <span className={s.sub}>{waiting ? 'You will see each one turn to Approved here.' : 'Tap a document to upload it now, or open the full list.'}</span>
        </span>
        <span className={s.go}>Open documents</span>
      </Link>

      {!waiting && (
        <ul className={s.list}>
          {todo.map((i, k) => (
            <li key={i.key} style={{ animationDelay: `${k * 60}ms` }}>
              <Link href={`/dashboard/business/documents?upload=${i.uploadType}`} className={s.item} data-again={i.status === 'rejected' || undefined}>
                <span className={s.dot} aria-hidden="true" />
                <span className={s.itemText}><b>{i.label}</b><small>{WORD[i.status]}</small></span>
                <span className={s.up}>Upload</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
