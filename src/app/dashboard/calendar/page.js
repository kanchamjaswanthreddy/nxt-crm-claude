'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import SegTabs from '@/components/ui/SegTabs';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { getDisplayName } from '@/lib/constants';
import { fetchCalendar, saveCalendarEvent, deleteCalendarEvent, respondToEvent, saveEventOutcome, saveEventAttendance, fetchBusy, searchRecords } from '@/app/actions/calendar';
import { fetchBookingSettings, saveBookingSettings } from '@/app/actions/booking';
import { createTask } from '@/app/actions/tasks';
import { fetchAgentDirectory } from '@/app/actions/directory';
import s from './calendar.module.css';

const TYPES = [
  { key: 'meeting', label: 'Team meeting' },
  { key: 'training', label: 'Training' },
  { key: 'client', label: 'Client appointment' },
  { key: 'personal', label: 'Personal' },
];
const SCOPE_LABEL = { private: 'Me and the people I invite', team: 'My whole team', agency: 'Everyone in the agency' };
const SCOPE_SHORT = { private: 'Private', team: 'Team', agency: 'Agency' };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REPEATS = [{ key: '', label: 'Does not repeat' }, { key: 'daily', label: 'Every day' }, { key: 'weekly', label: 'Every week' }, { key: 'biweekly', label: 'Every 2 weeks' }, { key: 'monthly', label: 'Every month' }];
const REPEAT_TEXT = { daily: 'Repeats every day', weekly: 'Repeats every week', biweekly: 'Repeats every 2 weeks', monthly: 'Repeats every month' };
const RECORD = { lead: { label: 'Lead', href: (id) => `/dashboard/leads/${id}` }, client: { label: 'Client', href: (id) => `/dashboard/clients/${id}` }, deal: { label: 'Deal', href: (id) => `/dashboard/deals/${id}` } };
const ANSWERS = [{ key: 'yes', label: 'Yes' }, { key: 'maybe', label: 'Maybe' }, { key: 'no', label: 'No' }];
const MY_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const timeToMin = (t) => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

// ── date helpers (all in the viewer's own time zone) ──
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(startOfDay(d), -d.getDay());
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeFmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayFmt = (d) => d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

function whenText(ev) {
  const a = new Date(ev.start); const b = new Date(ev.end);
  if (ev.allDay) return sameDay(a, b) ? `${dayFmt(a)}, all day` : `${dayFmt(a)} to ${dayFmt(b)}`;
  return sameDay(a, b) ? `${dayFmt(a)}, ${timeFmt(a)} to ${timeFmt(b)}` : `${dayFmt(a)} ${timeFmt(a)} to ${dayFmt(b)} ${timeFmt(b)}`;
}

function downloadIcs(ev) {
  const z = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NXT Financial Group//Back Office//EN', 'BEGIN:VEVENT', `UID:${ev.id}@nxtfinancialgroup.com`,
    `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(ev.start)}`, `DTEND:${z(ev.end)}`, `SUMMARY:${esc(ev.title)}`,
    ev.link ? `URL:${ev.link}` : '', (ev.location || ev.link) ? `LOCATION:${esc(ev.location || ev.link)}` : '',
    (ev.notes || ev.link) ? `DESCRIPTION:${esc([ev.notes, ev.link].filter(Boolean).join('\n'))}` : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = `${ev.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'event'}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const blankForm = (day) => {
  const base = day ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0) : (() => { const n = new Date(); n.setMinutes(0, 0, 0); n.setHours(n.getHours() + 1); return n; })();
  return { id: null, title: '', type: 'meeting', scope: 'private', allDay: false, start: toLocalInput(base), end: toLocalInput(new Date(base.getTime() + 36e5)), link: '', location: '', notes: '', attendeeIds: [], repeat: '', until: '', related: null };
};

export default function CalendarPage() {
  const toast = useToast();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState({ events: [], tasks: [], dates: [], scopes: ['private'], me: '', isLeader: false });
  const [whose, setWhose] = useState('mine');          // 'mine' or 'team' (team heads)
  const [busy, setBusy] = useState([]);
  const [recType, setRecType] = useState('');
  const [recQuery, setRecQuery] = useState('');
  const [recRows, setRecRows] = useState([]);
  const [outcome, setOutcome] = useState('');
  const [attended, setAttended] = useState([]);
  const [booking, setBooking] = useState(null);       // booking page settings pop-up
  const [bookingPath, setBookingPath] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState([]);           // event types switched off
  const [open, setOpen] = useState(null);             // event being viewed
  const [form, setForm] = useState(null);             // event being created or edited
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [people, setPeople] = useState([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const today = useMemo(() => startOfDay(new Date()), []);

  const range = useMemo(() => {
    if (view === 'week') { const a = startOfWeek(cursor); return { from: a, to: addDays(a, 7) }; }
    if (view === 'agenda') return { from: today, to: addDays(today, 60) };
    const a = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1)); return { from: a, to: addDays(a, 42) };
  }, [view, cursor, today]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetchCalendar(range.from.toISOString(), range.to.toISOString());
      if (r.success) setData(r); else setError(r.error || 'Could not load the calendar.');
    } catch { setError('Could not load the calendar.'); }
    setLoading(false);
  }, [range]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchAgentDirectory().then(r => { if (r.success) setPeople(r.agents.filter(a => a.status !== 'invited').map(a => ({ id: a.id, name: getDisplayName(a) })).sort((a, b) => a.name.localeCompare(b.name))); }).catch(() => {});
  }, []);
  const nameOf = useCallback((id) => people.find(p => p.id === id)?.name || 'Team member', [people]);

  const events = useMemo(() => data.events.filter(e => !hidden.includes(e.type) && (whose === 'team' ? !e.mine : e.mine)), [data.events, hidden, whose]);
  const itemsOn = useCallback((day) => {
    const a = day.getTime(); const b = addDays(day, 1).getTime();
    const evs = events.filter(e => new Date(e.start).getTime() < b && new Date(e.end).getTime() >= a);
    const tks = whose === 'team' ? [] : data.tasks.filter(t => { const d = new Date(t.due).getTime(); return d >= a && d < b; });
    const key = toDateInput(day); const dts = whose === 'team' ? [] : (data.dates || []).filter(x => x.day === key);
    return { evs, tks, dts };
  }, [events, data.tasks, data.dates, whose]);

  const move = (dir) => setCursor(c => view === 'week' ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1));
  const heading = view === 'week'
    ? `${startOfWeek(cursor).toLocaleDateString([], { month: 'short', day: 'numeric' })} to ${addDays(startOfWeek(cursor), 6).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
    : view === 'agenda' ? 'Next 60 days' : cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const startNew = (day, preset) => { setConfirmDelete(false); setPeopleQuery(''); setRecType(preset?.related?.type || ''); setRecQuery(''); setRecRows([]); setBusy([]); setForm({ ...blankForm(day), ...(preset || {}) }); };

  // Arriving from a lead, client or deal page: open a new event already linked to that record.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('new') && RECORD[q.get('relatedType')] && q.get('relatedId')) {
      const name = q.get('relatedName') || RECORD[q.get('relatedType')].label;
      startNew(null, { type: 'client', title: `Meeting with ${name}`, related: { type: q.get('relatedType'), id: q.get('relatedId'), name } });
      window.history.replaceState(null, '', '/dashboard/calendar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When an event is opened, load its notes and attendance into the pop-up.
  useEffect(() => { if (open) { setOutcome(open.outcome || ''); setAttended(open.attendance || []); } }, [open]);

  // Who is already busy at the chosen time.
  useEffect(() => {
    if (!form || form.allDay || form.scope !== 'private' || form.type === 'personal' || people.length === 0) { setBusy([]); return undefined; }
    const a = new Date(form.start); const b = new Date(form.end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return undefined;
    const t = setTimeout(() => { fetchBusy(people.map(p => p.id), a.toISOString(), b.toISOString(), form.id).then(r => { if (r.success) setBusy(r.busy); }).catch(() => {}); }, 350);
    return () => clearTimeout(t);
  }, [form?.start, form?.end, form?.allDay, form?.scope, form?.type, form?.id, people]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search leads, clients or deals to link.
  useEffect(() => {
    if (!form || !recType) { setRecRows([]); return undefined; }
    const t = setTimeout(() => { searchRecords(recType, recQuery).then(r => { if (r.success) setRecRows(r.rows); }).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [recType, recQuery, !!form]); // eslint-disable-line react-hooks/exhaustive-deps
  const startEdit = (ev) => {
    // a repeating event is edited as a whole series, from its first date
    const a = new Date(ev.repeat ? ev.seriesStart : ev.start); const b = new Date(ev.repeat ? ev.seriesEnd : ev.end);
    setOpen(null); setConfirmDelete(false); setPeopleQuery(''); setRecType(ev.related?.type || ''); setRecQuery(''); setBusy([]);
    setForm({ id: ev.id, title: ev.title, type: ev.type, scope: ev.scope, allDay: ev.allDay, start: ev.allDay ? toDateInput(a) : toLocalInput(a), end: ev.allDay ? toDateInput(b) : toLocalInput(b), link: ev.link, location: ev.location, notes: ev.notes, attendeeIds: ev.attendeeIds || [], repeat: ev.repeat?.freq || '', until: ev.repeat?.until || '', related: ev.related || null });
  };
  const setAllDay = (on) => setForm(f => {
    const a = new Date(f.start.length === 10 ? `${f.start}T10:00` : f.start); const b = new Date(f.end.length === 10 ? `${f.end}T11:00` : f.end);
    return { ...f, allDay: on, start: on ? toDateInput(a) : toLocalInput(a), end: on ? toDateInput(b) : toLocalInput(b) };
  });

  const submit = async (e) => {
    e.preventDefault(); if (saving) return;
    const start = form.allDay ? new Date(`${form.start}T00:00`) : new Date(form.start);
    const end = form.allDay ? new Date(`${form.end}T23:59`) : new Date(form.end);
    setSaving(true);
    const r = await saveCalendarEvent({ ...form, start: start.toISOString(), end: end.toISOString(), tz: MY_TZ, repeat: form.repeat ? { freq: form.repeat, until: form.until } : null }).catch(() => ({ success: false, error: 'Could not save the event.' }));
    setSaving(false);
    if (!r.success) { toast.error(r.error || 'Could not save the event.'); return; }
    toast.success(form.id ? 'Event updated' : 'Event added'); setForm(null); load();
  };
  const answer = async (a) => {
    const next = open.myRsvp === a ? '' : a;
    const r = await respondToEvent(open.id, next).catch(() => ({ success: false }));
    if (!r.success) { toast.error(r.error || 'Could not save your answer.'); return; }
    setOpen({ ...open, myRsvp: next }); load();
  };
  const saveNotes = async () => {
    const r = await saveEventOutcome(open.id, open.occ, outcome).catch(() => ({ success: false }));
    if (!r.success) { toast.error(r.error || 'Could not save the notes.'); return; }
    toast.success('Meeting notes saved'); load();
  };
  const followUp = async () => {
    const due = new Date(); due.setDate(due.getDate() + 2); due.setHours(10, 0, 0, 0);
    const r = await createTask({ title: `Follow up: ${open.related?.name || open.title}`, description: outcome || `After "${open.title}"`, dueAt: due.toISOString(), priority: 'medium',
      relatedLeadId: open.related?.type === 'lead' ? open.related.id : null, relatedDealId: open.related?.type === 'deal' ? open.related.id : null }).catch(() => ({ success: false }));
    if (!r.success) { toast.error(r.error || 'Could not create the task.'); return; }
    toast.success('Follow-up task added, due in 2 days'); load();
  };
  const saveAttendance = async () => {
    const r = await saveEventAttendance(open.id, open.occ, attended).catch(() => ({ success: false }));
    if (!r.success) { toast.error(r.error || 'Could not save attendance.'); return; }
    toast.success(`Attendance saved: ${attended.length} attended`); load();
  };
  const openBooking = async () => {
    const r = await fetchBookingSettings().catch(() => ({ success: false }));
    if (!r.success) { toast.error(r.error || 'Could not load your booking page.'); return; }
    setCopied(false); setBookingPath(r.path); setBooking({ ...r.settings, tz: r.settings.enabled ? r.settings.tz : MY_TZ });
  };
  const saveBooking = async (e) => {
    e.preventDefault();
    const r = await saveBookingSettings(booking).catch(() => ({ success: false }));
    if (!r.success) { toast.error(r.error || 'Could not save.'); return; }
    toast.success(r.settings.enabled ? 'Booking page is on' : 'Booking page is off'); setBooking(r.settings);
  };
  const copyBooking = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}${bookingPath}`); setCopied(true); } catch { toast.error('Could not copy. Select the link and copy it.'); } };

  const remove = async (onlyThis) => {
    const r = await deleteCalendarEvent(open.id, onlyThis ? open.occ : null).catch(() => ({ success: false, error: 'Could not delete the event.' }));
    if (!r.success) { toast.error(r.error || 'Could not delete the event.'); return; }
    toast.success('Event deleted'); setOpen(null); setConfirmDelete(false); load();
  };

  const Pill = ({ ev }) => (
    <button type="button" className={s.pill} data-type={ev.type} data-declined={ev.myRsvp === 'no' || undefined} onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); setOpen(ev); }} title={`${ev.title}, ${whenText(ev)}`}>
      {!ev.allDay && <span className={s.pillTime}>{timeFmt(new Date(ev.start))}</span>}
      <span className={s.pillTitle}>{whose === 'team' ? `${ev.createdByName.split(' ')[0]}: ` : ''}{ev.title}</span>
    </button>
  );
  const DatePill = ({ x }) => <Link href={x.href} className={s.datePill} data-kind={x.kind} title={x.title} onClick={(e) => e.stopPropagation()}><span className={s.pillTitle}>{x.title}</span></Link>;
  const TaskPill = ({ t }) => <Link href="/dashboard/tasks" className={s.taskPill} title={`Task due: ${t.title}`} onClick={(e) => e.stopPropagation()}><span className={s.pillTitle}>{t.title}</span></Link>;

  const monthDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(range.from, i)), [range.from]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)), [cursor]);
  const agendaDays = useMemo(() => view !== 'agenda' ? [] : Array.from({ length: 60 }, (_, i) => addDays(today, i)).map(d => ({ d, ...itemsOn(d) })).filter(x => x.evs.length || x.tks.length || x.dts.length), [view, today, itemsOn]);
  const filteredPeople = people.filter(p => p.id !== data.me && p.name.toLowerCase().includes(peopleQuery.trim().toLowerCase()));

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Agency events, team events and your own schedule in one place."
        actions={<><button type="button" className="nxt-btn" onClick={openBooking}>Booking Page</button><button type="button" className="nxt-btn nxt-btn-primary" onClick={() => startNew(null)}>+ New Event</button></>} />

      <div className={s.bar}>
        <div className={s.nav}>
          {view !== 'agenda' && <>
            <button type="button" className="nxt-btn nxt-btn-icon" onClick={() => move(-1)} aria-label="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" className="nxt-btn nxt-btn-icon" onClick={() => move(1)} aria-label="Next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <button type="button" className="nxt-btn" onClick={() => setCursor(today)}>Today</button>
          </>}
          <h2 className={s.heading} aria-live="polite">{heading}</h2>
        </div>
        <div className={s.nav}>
          {data.isLeader && <SegTabs label="Whose calendar" value={whose} onChange={setWhose} tabs={[{ key: 'mine', label: 'My Calendar' }, { key: 'team', label: 'My Team' }]} />}
          <SegTabs label="Calendar view" value={view} onChange={setView} tabs={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }, { key: 'agenda', label: 'Agenda' }]} />
        </div>
      </div>

      <div className={s.legend} role="group" aria-label="Show or hide event types">
        {TYPES.map(t => (
          <button key={t.key} type="button" className={s.chip} data-type={t.key} aria-pressed={!hidden.includes(t.key)} onClick={() => setHidden(h => h.includes(t.key) ? h.filter(x => x !== t.key) : [...h, t.key])}>
            <i aria-hidden="true" />{t.label}
          </button>
        ))}
        <span className={s.chip} data-type="task" aria-hidden="true"><i />Task due</span>
        <span className={s.chip} data-type="date" aria-hidden="true"><i />Birthday or policy end</span>
        {loading && <span className={s.loading}>Loading…</span>}
      </div>

      {error && <p className={s.error} role="alert">{error}</p>}

      {view === 'month' && (
        <div className={s.month}>
          <div className={s.weekHead}>{WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
          <div className={s.grid}>
            {monthDays.map(day => {
              const { evs, tks, dts } = itemsOn(day); const all = evs.length + tks.length + dts.length; const room = 3;
              return (
                <div key={day.toISOString()} className={s.cell} data-out={day.getMonth() !== cursor.getMonth() || undefined} data-today={sameDay(day, today) || undefined}
                  role="button" tabIndex={0} aria-label={`Add an event on ${dayFmt(day)}`} onClick={() => startNew(day)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) startNew(day); }}>
                  <span className={s.dayNo}>{day.getDate()}</span>
                  {evs.slice(0, room).map(ev => <Pill key={ev.key} ev={ev} />)}
                  {tks.slice(0, Math.max(0, room - evs.length)).map(t => <TaskPill key={t.id} t={t} />)}
                  {dts.slice(0, Math.max(0, room - evs.length - tks.length)).map((x, i) => <DatePill key={i} x={x} />)}
                  {all > room && <button type="button" className={s.more} onClick={(e) => { e.stopPropagation(); setCursor(day); setView('week'); }}>+{all - room} more</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className={s.week}>
          {weekDays.map(day => {
            const { evs, tks, dts } = itemsOn(day);
            return (
              <section key={day.toISOString()} className={s.weekCol} data-today={sameDay(day, today) || undefined}>
                <header><span>{WEEKDAYS[day.getDay()]}</span><b>{day.getDate()}</b></header>
                <div className={s.weekBody}>
                  {evs.map(ev => <Pill key={ev.key} ev={ev} />)}
                  {tks.map(t => <TaskPill key={t.id} t={t} />)}
                  {dts.map((x, i) => <DatePill key={i} x={x} />)}
                  <button type="button" className={s.addHere} onClick={() => startNew(day)} aria-label={`Add an event on ${dayFmt(day)}`}>+ Add</button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === 'agenda' && (
        <div className={s.agenda}>
          {agendaDays.length === 0 && !loading && (
            <div className={s.empty}>
              <p className={s.emptyTitle}>Nothing scheduled in the next 60 days</p>
              <p className={s.emptyText}>Add an event and it will show up here.</p>
              <button type="button" className="nxt-btn nxt-btn-primary" onClick={() => startNew(null)}>+ New Event</button>
            </div>
          )}
          {agendaDays.map(({ d, evs, tks, dts }) => (
            <section key={d.toISOString()} className={s.agendaDay}>
              <h3>{sameDay(d, today) ? 'Today' : sameDay(d, addDays(today, 1)) ? 'Tomorrow' : dayFmt(d)}</h3>
              <ul>
                {evs.map(ev => (
                  <li key={ev.key}>
                    <button type="button" className={s.agendaRow} data-type={ev.type} onClick={() => { setConfirmDelete(false); setOpen(ev); }}>
                      <span className={s.agendaTime}>{ev.allDay ? 'All day' : `${timeFmt(new Date(ev.start))} to ${timeFmt(new Date(ev.end))}`}</span>
                      <span className={s.agendaTitle}>{ev.title}</span>
                      <span className={s.agendaMeta}>{whose === 'team' ? ev.createdByName : SCOPE_SHORT[ev.scope]}{ev.repeat ? ', repeats' : ''}{ev.link ? ', has link' : ''}</span>
                    </button>
                  </li>
                ))}
                {tks.map(t => <li key={t.id}><Link href="/dashboard/tasks" className={s.agendaRow} data-type="task"><span className={s.agendaTime}>Task due</span><span className={s.agendaTitle}>{t.title}</span><span className={s.agendaMeta}>Open tasks</span></Link></li>)}
                {dts.map((x, i) => <li key={`d${i}`}><Link href={x.href} className={s.agendaRow} data-type="date"><span className={s.agendaTime}>{x.kind === 'birthday' ? 'Birthday' : 'Policy ends'}</span><span className={s.agendaTitle}>{x.title}</span><span className={s.agendaMeta}>Open client</span></Link></li>)}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* View one event */}
      <Modal isOpen={!!open} onClose={() => setOpen(null)} title={open?.title || ''} size="md"
        footer={open && (
          <div className={s.modalFoot}>
            {open.canEdit && !confirmDelete && <button type="button" className="nxt-btn nxt-btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>}
            {open.canEdit && confirmDelete && !open.repeat && <><span className={s.confirmText}>Delete this event for everyone?</span><button type="button" className="nxt-btn" onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="nxt-btn nxt-btn-danger" onClick={() => remove(false)}>Yes, Delete</button></>}
            {open.canEdit && confirmDelete && open.repeat && <><span className={s.confirmText}>This event repeats.</span><button type="button" className="nxt-btn" onClick={() => setConfirmDelete(false)}>Keep</button><button type="button" className="nxt-btn nxt-btn-danger" onClick={() => remove(true)}>Delete This Date</button><button type="button" className="nxt-btn nxt-btn-danger" onClick={() => remove(false)}>Delete All Dates</button></>}
            <span className={s.spacer} />
            {!confirmDelete && <button type="button" className="nxt-btn" onClick={() => downloadIcs(open)}>Add to My Calendar</button>}
            {!confirmDelete && open.canEdit && <button type="button" className="nxt-btn" onClick={() => startEdit(open)}>{open.repeat ? 'Edit Series' : 'Edit'}</button>}
            {!confirmDelete && open.link && <a className="nxt-btn nxt-btn-primary" href={open.link} target="_blank" rel="noopener noreferrer">Join Meeting</a>}
          </div>
        )}>
        {open && (
          <dl className={s.detail}>
            <div><dt>When</dt><dd>{whenText(open)}{open.repeat && <span className={s.repeatNote}>{REPEAT_TEXT[open.repeat.freq]} until {new Date(`${open.repeat.until}T12:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>}</dd></div>
            <div><dt>Type</dt><dd><span className={s.tag} data-type={open.type}>{TYPES.find(t => t.key === open.type)?.label}</span></dd></div>
            <div><dt>Who sees it</dt><dd>{open.scope === 'private' ? (open.attendeeIds.length ? `${open.createdByName} and ${open.attendeeIds.length} invited` : 'Only the organiser') : SCOPE_LABEL[open.scope]}</dd></div>
            <div><dt>Organiser</dt><dd>{open.createdByName || 'Unknown'}</dd></div>
            {open.attendeeIds.length > 0 && <div><dt>Invited</dt><dd>{open.attendeeIds.map(nameOf).join(', ')}</dd></div>}
            {open.location && <div><dt>Where</dt><dd>{open.location}</dd></div>}
            {open.link && <div><dt>Meeting link</dt><dd><a href={open.link} target="_blank" rel="noopener noreferrer">{open.link}</a></dd></div>}
            {open.notes && <div><dt>Notes</dt><dd className={s.notes}>{open.notes}</dd></div>}
            {open.related && <div><dt>{RECORD[open.related.type].label}</dt><dd><Link href={RECORD[open.related.type].href(open.related.id)}>{open.related.name}</Link></dd></div>}
            {open.guest && <div><dt>Booked by</dt><dd>{[open.guest.name, open.guest.email, open.guest.phone].filter(Boolean).join(', ')}</dd></div>}
            {open.type !== 'personal' && (
              <div><dt>{open.createdBy === data.me ? 'Answers' : 'Are you going?'}</dt><dd>
                {open.createdBy !== data.me && <span className={s.rsvp}>{ANSWERS.map(a => <button key={a.key} type="button" className={s.rsvpBtn} data-answer={a.key} aria-pressed={open.myRsvp === a.key} onClick={() => answer(a.key)}>{a.label}</button>)}</span>}
                <span className={s.rsvpCount}>{open.rsvpCounts.yes} yes, {open.rsvpCounts.maybe} maybe, {open.rsvpCounts.no} no</span>
                {open.rsvp && Object.keys(open.rsvp).length > 0 && <span className={s.rsvpNames}>{Object.entries(open.rsvp).map(([id, a]) => `${nameOf(id)} (${a})`).join(', ')}</span>}
              </dd></div>
            )}
          </dl>
        )}
        {open && open.canEdit && open.type !== 'personal' && new Date(open.start) <= new Date() && (
          <div className={s.after}>
            <section>
              <h3>Meeting notes</h3>
              <textarea rows={3} maxLength={4000} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What was discussed, and what happens next" aria-label="Meeting notes" />
              <div className={s.afterBtns}><button type="button" className="nxt-btn nxt-btn-sm" onClick={saveNotes}>Save Notes</button><button type="button" className="nxt-btn nxt-btn-sm" onClick={followUp}>Add Follow-up Task</button></div>
            </section>
            {(open.scope !== 'private' || open.attendeeIds.length > 0) && (
              <section>
                <h3>Attendance <span>{attended.length} attended</span></h3>
                <div className={s.people}>
                  {(open.scope === 'private' ? people.filter(p => open.attendeeIds.includes(p.id)) : people.filter(p => p.id !== data.me)).map(p => (
                    <label key={p.id} className={s.person}><input type="checkbox" checked={attended.includes(p.id)} onChange={(e) => setAttended(e.target.checked ? [...attended, p.id] : attended.filter(x => x !== p.id))} /><span>{p.name}</span></label>
                  ))}
                </div>
                <div className={s.afterBtns}><button type="button" className="nxt-btn nxt-btn-sm" onClick={saveAttendance}>Save Attendance</button></div>
              </section>
            )}
          </div>
        )}
      </Modal>

      {/* Create or edit */}
      <Modal isOpen={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit event' : 'New event'} size="md"
        footer={form && (
          <div className={s.modalFoot}>
            <span className={s.spacer} />
            <button type="button" className="nxt-btn" onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" form="calendar-event-form" className="nxt-btn nxt-btn-primary" disabled={saving}>{saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Event'}</button>
          </div>
        )}>
        {form && (
          <form id="calendar-event-form" className={s.form} onSubmit={submit}>
            <label className={s.full}><span>Title</span><input type="text" required maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Monday team call" autoFocus /></label>
            <label><span>Type</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, scope: e.target.value === 'personal' ? 'private' : form.scope })}>{TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
            </label>
            <label><span>Who sees it</span>
              <select value={form.scope} disabled={form.type === 'personal'} onChange={(e) => setForm({ ...form, scope: e.target.value })}>{data.scopes.slice().reverse().map(k => <option key={k} value={k}>{SCOPE_LABEL[k]}</option>)}</select>
            </label>
            <label className={s.check}><input type="checkbox" checked={form.allDay} onChange={(e) => setAllDay(e.target.checked)} /><span>All day</span></label>
            <label><span>Starts</span><input type={form.allDay ? 'date' : 'datetime-local'} required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: form.end < e.target.value ? e.target.value : form.end })} /></label>
            <label><span>Ends</span><input type={form.allDay ? 'date' : 'datetime-local'} required min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
            {!form.allDay && <>
              <label><span>Repeats</span><select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>{REPEATS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
              <label><span>Until <em>up to 1 year</em></span><input type="date" disabled={!form.repeat} min={form.start.slice(0, 10)} value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} /></label>
            </>}
            <label className={s.full}><span>Meeting link <em>optional</em></span><input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></label>
            <label className={s.full}><span>Where <em>optional</em></span><input type="text" maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Office, or a client's address" /></label>
            {form.scope === 'private' && form.type !== 'personal' && (
              <fieldset className={s.full}>
                <legend>Invite people <em>optional</em>{form.attendeeIds.length > 0 && <b> {form.attendeeIds.length} selected</b>}</legend>
                <input type="search" value={peopleQuery} onChange={(e) => setPeopleQuery(e.target.value)} placeholder="Search by name" aria-label="Search people" />
                <div className={s.people}>
                  {filteredPeople.map(p => (
                    <label key={p.id} className={s.person}><input type="checkbox" checked={form.attendeeIds.includes(p.id)} onChange={(e) => setForm({ ...form, attendeeIds: e.target.checked ? [...form.attendeeIds, p.id] : form.attendeeIds.filter(x => x !== p.id) })} /><span>{p.name}</span>{busy.includes(p.id) && <b className={s.busy}>Busy then</b>}</label>
                  ))}
                  {filteredPeople.length === 0 && <p className={s.none}>No one matches.</p>}
                </div>
              </fieldset>
            )}
            {form.type !== 'personal' && (
              <fieldset className={s.full}>
                <legend>Link to a lead, client or deal <em>optional</em></legend>
                {form.related ? (
                  <p className={s.linked}><span>{RECORD[form.related.type].label}: <b>{form.related.name}</b></span><button type="button" className="nxt-btn nxt-btn-sm" onClick={() => setForm({ ...form, related: null })}>Remove</button></p>
                ) : (
                  <div className={s.recordPick}>
                    <select value={recType} onChange={(e) => { setRecType(e.target.value); setRecQuery(''); }} aria-label="Record type"><option value="">None</option><option value="lead">Lead</option><option value="client">Client</option><option value="deal">Deal</option></select>
                    {recType && <input type="search" value={recQuery} onChange={(e) => setRecQuery(e.target.value)} placeholder={`Search ${recType}s by name`} aria-label="Search records" />}
                    {recType && <div className={s.people}>{recRows.map(r => <button key={r.id} type="button" className={s.recordRow} onClick={() => setForm({ ...form, related: { type: recType, id: r.id, name: r.name } })}>{r.name}</button>)}{recRows.length === 0 && <p className={s.none}>No {recType}s found.</p>}</div>}
                  </div>
                )}
              </fieldset>
            )}
            <label className={s.full}><span>Notes <em>optional</em></span><textarea rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </form>
        )}
      </Modal>

      {/* Booking page settings */}
      <Modal isOpen={!!booking} onClose={() => setBooking(null)} title="Your booking page" size="md"
        footer={booking && (<div className={s.modalFoot}><span className={s.spacer} /><button type="button" className="nxt-btn" onClick={() => setBooking(null)}>Close</button><button type="submit" form="booking-form" className="nxt-btn nxt-btn-primary">Save</button></div>)}>
        {booking && (
          <form id="booking-form" className={s.form} onSubmit={saveBooking}>
            <p className={`${s.full} ${s.help}`}>Share one link and let clients pick a free time. They see only your name and open times; the appointment lands on your calendar and a new person becomes a lead.</p>
            <label className={`${s.check} ${s.full}`}><input type="checkbox" checked={booking.enabled} onChange={(e) => setBooking({ ...booking, enabled: e.target.checked })} /><span>Let people book time with me</span></label>
            <fieldset className={s.full}><legend>Days</legend>
              <div className={s.dayPick}>{WEEKDAYS.map((d, i) => <label key={d} data-on={booking.days.includes(i) || undefined}><input type="checkbox" checked={booking.days.includes(i)} onChange={(e) => setBooking({ ...booking, days: e.target.checked ? [...booking.days, i].sort() : booking.days.filter(x => x !== i) })} />{d}</label>)}</div>
            </fieldset>
            <label><span>From</span><input type="time" step={900} value={minToTime(booking.startMin)} onChange={(e) => setBooking({ ...booking, startMin: timeToMin(e.target.value) })} /></label>
            <label><span>To</span><input type="time" step={900} value={minToTime(booking.endMin)} onChange={(e) => setBooking({ ...booking, endMin: timeToMin(e.target.value) })} /></label>
            <label><span>Appointment length</span><select value={booking.slotMin} onChange={(e) => setBooking({ ...booking, slotMin: Number(e.target.value) })}>{[15, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}</select></label>
            <label><span>Time zone</span><input type="text" value={booking.tz} onChange={(e) => setBooking({ ...booking, tz: e.target.value })} /></label>
            <label className={s.full}><span>Short note for visitors <em>optional</em></span><input type="text" maxLength={300} value={booking.intro} onChange={(e) => setBooking({ ...booking, intro: e.target.value })} placeholder="A free 30-minute review of your coverage" /></label>
            {booking.enabled && (
              <div className={`${s.full} ${s.shareLink}`}><code>{typeof window !== 'undefined' ? window.location.origin : ''}{bookingPath}</code><button type="button" className="nxt-btn nxt-btn-sm" onClick={copyBooking}>{copied ? 'Copied' : 'Copy Link'}</button></div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
