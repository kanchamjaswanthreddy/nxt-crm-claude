'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { getBookingPage, createBooking } from '@/app/actions/booking';
import s from './book.module.css';

const dayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function BookPage() {
  const { agentId } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '', website: '' });
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  // Group the free times by the visitor's own calendar day (their time zone may differ from the agent's).
  const byLocalDay = (r) => {
    const map = new Map();
    r.days.flatMap(d => d.slots).sort().forEach(t => { const d = new Date(t); const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; if (!map.has(k)) map.set(k, []); map.get(k).push(t); });
    return { ...r, days: [...map.entries()].map(([day, slots]) => ({ day, slots })) };
  };
  const load = () => getBookingPage(agentId).then(r => { if (r.success) { setPage(byLocalDay(r)); setError(''); } else setError(r.error); }).catch(() => setError('This booking page is not available.'));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [agentId]);

  const submit = async (e) => {
    e.preventDefault(); if (sending) return;
    setSending(true); setFormError('');
    const r = await createBooking(agentId, { ...form, slot }).catch(() => ({ success: false, error: 'Something went wrong. Please try again.' }));
    setSending(false);
    if (!r.success) { setFormError(r.error); if (/taken/.test(r.error || '')) { setSlot(''); load(); } return; }
    setDone(r.start ? r : { start: slot, agentName: page.name });
  };

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = page?.days[dayIdx];

  return (
    <main className={s.page}>
      <div className={s.card}>
        <header className={s.head}>
          <Image src="/new-nxt-logo.png" alt="NXT Financial Group" width={186} height={60} style={{ width: 'auto', height: 52 }} priority />
          {page && !done && <><p className={s.kicker}>Book a time with</p><h1 className={s.title}>{page.name}</h1>{page.intro && <p className={s.intro}>{page.intro}</p>}<p className={s.meta}>{page.slotMin} minutes. Times shown in your time zone ({tz.replace(/_/g, ' ')}).</p></>}
        </header>

        {error && <div className={s.state}><h1 className={s.title}>Not available</h1><p>{error}</p></div>}
        {!page && !error && <div className={s.state}><p>Loading available times…</p></div>}

        {done && (
          <div className={s.state} role="status">
            <span className={s.tick} aria-hidden="true">✓</span>
            <h1 className={s.title}>You are booked</h1>
            <p className={s.when}>{new Date(done.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} at {timeLabel(done.start)}</p>
            <p>with {done.agentName || page?.name}. They will be in touch with the details.</p>
          </div>
        )}

        {page && !done && page.days.length === 0 && <div className={s.state}><p>There are no open times in the next two weeks. Please check back soon.</p></div>}

        {page && !done && page.days.length > 0 && (
          <div className={s.body}>
            <section>
              <h2 className={s.step}><b>1</b>Choose a day</h2>
              <div className={s.days}>{page.days.map((d, i) => <button key={d.day} type="button" className={s.day} aria-pressed={i === dayIdx} onClick={() => { setDayIdx(i); setSlot(''); }}>{dayLabel(d.slots[0])}</button>)}</div>
              <h2 className={s.step}><b>2</b>Choose a time</h2>
              <div className={s.slots}>{day.slots.map(t => <button key={t} type="button" className={s.slot} aria-pressed={t === slot} onClick={() => setSlot(t)}>{timeLabel(t)}</button>)}</div>
            </section>
            <form className={s.form} onSubmit={submit}>
              <h2 className={s.step}><b>3</b>Your details</h2>
              <label><span>Full name</span><input type="text" required maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label><span>Email</span><input type="email" required maxLength={120} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label><span>Phone <em>optional</em></span><input type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label><span>What would you like to talk about? <em>optional</em></span><textarea rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              <label className={s.hp} aria-hidden="true"><span>Website</span><input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
              {formError && <p className={s.error} role="alert">{formError}</p>}
              <button type="submit" className={s.submit} disabled={!slot || sending}>{sending ? 'Booking…' : slot ? `Book ${dayLabel(slot)}, ${timeLabel(slot)}` : 'Choose a time first'}</button>
            </form>
          </div>
        )}
        <footer className={s.foot}>NXT Financial Group</footer>
      </div>
    </main>
  );
}
