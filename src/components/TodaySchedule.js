'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCalendar } from '@/app/actions/calendar';
import s from './TodaySchedule.module.css';

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Dashboard card: what is on the calendar today, with a Join button and a "starting soon" marker. */
export default function TodaySchedule() {
  const [events, setEvents] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start.getTime() + 864e5 - 1);
    fetchCalendar(start.toISOString(), end.toISOString()).then(r => setEvents(r.success ? r.events.filter(e => e.mine && e.myRsvp !== 'no') : [])).catch(() => setEvents([]));
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (events === null) return null;
  const left = events.filter(e => new Date(e.end).getTime() >= now);

  return (
    <section className={s.card} aria-label="Today's schedule">
      <header className={s.head}>
        <div><p className={s.label}>Today&rsquo;s schedule</p><h2 className={s.title}>{left.length === 0 ? (events.length ? 'All done for today' : 'Nothing scheduled today') : `${left.length} ${left.length === 1 ? 'event' : 'events'} to go`}</h2></div>
        <Link href="/dashboard/calendar" className="nxt-btn nxt-btn-sm">Open Calendar</Link>
      </header>
      {left.length > 0 && (
        <ul className={s.list}>
          {left.slice(0, 4).map(e => {
            const mins = Math.round((new Date(e.start).getTime() - now) / 60000); const live = mins <= 0; const soon = mins > 0 && mins <= 15;
            return (
              <li key={e.key} className={s.row} data-type={e.type}>
                <span className={s.time}>{e.allDay ? 'All day' : time(e.start)}</span>
                <span className={s.name}>{e.title}{(live || soon) && !e.allDay && <b className={s.soon}>{live ? 'Happening now' : `Starts in ${mins} min`}</b>}</span>
                {e.link ? <a className="nxt-btn nxt-btn-sm nxt-btn-primary" href={e.link} target="_blank" rel="noopener noreferrer">Join</a> : <span />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
