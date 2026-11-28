'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchRecordEvents } from '@/app/actions/calendar';

/** On a lead, client or deal page: a Schedule Meeting button and the meetings linked to this record. */
export default function RecordMeetings({ type, id, name }) {
  const [events, setEvents] = useState([]);
  useEffect(() => { if (id) fetchRecordEvents(type, id).then(r => { if (r.success) setEvents(r.events); }).catch(() => {}); }, [type, id]);
  const now = new Date().toISOString();
  const upcoming = events.filter(e => e.end >= now).slice(0, 3); const past = events.filter(e => e.end < now).slice(-2).reverse();
  const href = `/dashboard/calendar?new=1&relatedType=${type}&relatedId=${encodeURIComponent(id)}&relatedName=${encodeURIComponent(name || '')}`;
  const line = (e) => `${new Date(e.start).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return (
    <section style={{ padding: '18px 20px', marginBottom: 20, borderRadius: 22, background: '#fff', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--brand-navy)' }}>Meetings</h3>
        <Link href={href} className="nxt-btn nxt-btn-sm">Schedule Meeting</Link>
      </div>
      {events.length === 0 && <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: 15 }}>No meetings yet.</p>}
      {[['Upcoming', upcoming], ['Recent', past]].map(([label, list]) => list.length > 0 && (
        <div key={label} style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#8A5A0B' }}>{label}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {list.map(e => <li key={e.key} style={{ display: 'flex', gap: 12, fontSize: 15, color: 'var(--brand-navy)' }}><span style={{ minWidth: 130, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{line(e)}</span><span>{e.title}</span></li>)}
          </ul>
        </div>
      ))}
    </section>
  );
}
