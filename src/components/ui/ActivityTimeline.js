'use client';

import React from 'react';
import s from './ActivityTimeline.module.css';

const TYPE_ICONS = {
  note: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
    </svg>
  ),
  status: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  task: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  ),
  deal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  ),
  created: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Activity timeline component for lead/client detail pages.
 *
 * @param {{ events: Array<{ id: string, type: string, title: string, description?: string, createdAt: string, actor?: string }> }} props
 */
export default function ActivityTimeline({ events = [] }) {
  if (events.length === 0) {
    return (
      <div className={s.empty}>
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className={s.timeline}>
      {events.map((event, i) => (
        <div key={event.id || i} className={s.item}>
          <div className={s.line}>
            <div className={`${s.dot} ${s[`dot_${event.type}`] || ''}`}>
              {TYPE_ICONS[event.type] || TYPE_ICONS.note}
            </div>
            {i < events.length - 1 && <div className={s.connector} />}
          </div>
          <div className={s.content}>
            <div className={s.header}>
              <span className={s.title}>{event.title}</span>
              <span className={s.time}>{formatDate(event.createdAt)}</span>
            </div>
            {event.description && <p className={s.desc}>{event.description}</p>}
            {event.actor && <span className={s.actor}>{event.actor}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
