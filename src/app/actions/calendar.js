'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, isTeamLeader } from '@/lib/serverAuth';
import { occurrences, safeTz, REPEAT_FREQS } from '@/lib/calendarTime';

// Shared calendar. Events live in `calendarEvents` and are only ever read or written here, on the server.
//   scope 'agency'  : everyone in the agency sees it (owners and admins create these)
//   scope 'team'    : the creator and everyone under them (team heads, owners and admins create these)
//   scope 'private' : the creator, the people they invite, and the creator's uplines
// A repeating event is one record; its dates are worked out when the calendar is read.
// Times are stored as ISO strings in UTC; each browser shows them in its own time zone.

const TYPES = ['meeting', 'training', 'client', 'personal'];
const SCOPES = ['agency', 'team', 'private'];
const ANSWERS = ['yes', 'no', 'maybe'];
const RELATED = { lead: 'leads', client: 'clients', deal: 'deals' };
const privileged = (u) => u.isOwner || u.role === 'admin' || u.role === 'it_engineer';
const text = (v, max) => String(v || '').trim().slice(0, max);
const validDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const OCC = /^\d{4}-\d{2}-\d{2}$/;

async function loadCaller() {
  const caller = await requireUser();
  const db = getAdminApp().firestore();
  const snap = await db.collection('agents').doc(caller.uid).get();
  const path = (snap.exists && snap.data().hierarchyPath) || `/${caller.uid}`;
  return { caller, db, path };
}

function canSee(ev, caller, path) {
  if (ev.createdBy === caller.uid) return true;
  if (ev.scope === 'agency') return true;
  if ((ev.attendeeIds || []).includes(caller.uid)) return true;
  // the caller sits above the creator (an upline, owner included)
  const callerIsAbove = (ev.creatorPath || '').includes(`/${caller.uid}/`);
  if (ev.scope === 'team') return path.includes(`/${ev.createdBy}/`) || callerIsAbove || privileged(caller);
  // private: uplines can see their people's work events, but never ones marked personal
  if (ev.type === 'personal') return false;
  return callerIsAbove || privileged(caller);
}
const canEdit = (ev, caller) => ev.createdBy === caller.uid || privileged(caller);

function shape(id, ev, o, caller) {
  const rsvp = ev.rsvp || {}; const mine = canEdit(ev, caller);
  const counts = { yes: 0, no: 0, maybe: 0 }; Object.values(rsvp).forEach(a => { if (counts[a] !== undefined) counts[a] += 1; });
  return {
    id, occ: o.occ, key: `${id}:${o.occ}`, title: ev.title, type: ev.type, scope: ev.scope,
    start: o.start.toISOString(), end: o.end.toISOString(), allDay: !!ev.allDay,
    seriesStart: ev.start, seriesEnd: ev.end, repeat: ev.repeat || null,
    link: ev.link || '', location: ev.location || '', notes: ev.notes || '',
    createdBy: ev.createdBy, createdByName: ev.createdByName || '', attendeeIds: ev.attendeeIds || [],
    related: ev.related || null, source: ev.source || '',
    myRsvp: rsvp[caller.uid] || '', rsvpCounts: counts, rsvp: mine ? rsvp : undefined,
    outcome: mine ? ((ev.outcome || {})[o.occ] || '') : undefined,
    attendance: mine ? ((ev.attendance || {})[o.occ] || []) : undefined,
    guest: mine ? (ev.guest || null) : undefined,
    canEdit: mine, mine: ev.createdBy === caller.uid || (ev.attendeeIds || []).includes(caller.uid) || ev.scope !== 'private',
  };
}

/** Everything the caller may see between two dates: events, their own due tasks, client birthdays and policy end dates. */
export async function fetchCalendar(fromISO, toISO) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db, path } = ctx;
  const from = validDate(fromISO); const to = validDate(toISO);
  if (!from || !to || to - from > 120 * 864e5) return { success: false, error: 'Bad date range.' };
  try {
    const [evSnap, taskSnap, leader, clientSnap] = await Promise.all([
      db.collection('calendarEvents').where('agencyId', '==', caller.agencyId).get(),
      db.collection('tasks').where('agencyId', '==', caller.agencyId).where('ownerAgentId', '==', caller.uid).get(),
      isTeamLeader(caller.uid, caller.agencyId),
      db.collection('clients').where('agencyId', '==', caller.agencyId).where('agentId', '==', caller.uid).get().catch(() => null),
    ]);
    const events = [];
    evSnap.forEach(d => {
      const ev = d.data();
      if (!canSee(ev, caller, path)) return;
      occurrences(ev, from, to).forEach(o => events.push(shape(d.id, ev, o, caller)));
    });
    const tasks = [];
    taskSnap.forEach(d => {
      const t = d.data(); const due = t.dueAt?.toDate?.();
      if (!due || t.status === 'done' || t.status === 'completed' || due < from || due > to) return;
      tasks.push({ id: d.id, title: t.title || 'Task', due: due.toISOString() });
    });

    // The caller's own clients: birthdays, and policies that end in this window.
    const dates = [];
    if (clientSnap) {
      const clients = clientSnap.docs.slice(0, 400);
      clients.forEach(d => {
        const c = d.data(); const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(c.dateOfBirth || '');
        if (!m) return;
        for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
          const day = `${y}-${m[2]}-${m[3]}`;
          if (day >= fromISO.slice(0, 10) && day <= toISO.slice(0, 10)) dates.push({ kind: 'birthday', day, title: `${[c.firstName, c.lastName].filter(Boolean).join(' ')}'s birthday`, href: `/dashboard/clients/${d.id}` });
        }
      });
      const policySnaps = await Promise.all(clients.slice(0, 80).map(d => d.ref.collection('policies').get().catch(() => null)));
      policySnaps.forEach((ps, i) => {
        if (!ps) return; const c = clients[i].data();
        ps.forEach(pd => {
          const p = pd.data(); const day = String(p.expiryDate || '').slice(0, 10);
          if (OCC.test(day) && day >= fromISO.slice(0, 10) && day <= toISO.slice(0, 10)) dates.push({ kind: 'renewal', day, title: `${p.carrier || 'Policy'} policy ends: ${[c.firstName, c.lastName].filter(Boolean).join(' ')}`, href: `/dashboard/clients/${clients[i].id}` });
        });
      });
    }

    events.sort((a, b) => a.start.localeCompare(b.start));
    return { success: true, events, tasks, dates, me: caller.uid, isLeader: leader || privileged(caller), scopes: privileged(caller) ? SCOPES : leader ? ['team', 'private'] : ['private'] };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Create (no id) or update (id) an event. For a repeating event this changes the whole series. */
export async function saveCalendarEvent(input) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db, path } = ctx;
  const admin = getAdminApp();

  const title = text(input?.title, 140);
  const start = validDate(input?.start); const end = validDate(input?.end);
  const type = TYPES.includes(input?.type) ? input.type : 'meeting';
  let scope = SCOPES.includes(input?.scope) ? input.scope : 'private';
  if (!title) return { success: false, error: 'Give the event a title.' };
  if (!start || !end) return { success: false, error: 'Choose a start and an end.' };
  if (end < start) return { success: false, error: 'The end is before the start.' };
  if (end - start > 31 * 864e5) return { success: false, error: 'An event can be at most 31 days long.' };
  const link = text(input?.link, 500);
  if (link && !/^https:\/\//i.test(link)) return { success: false, error: 'The meeting link must start with https://' };
  if (type === 'personal') scope = 'private';

  let repeat = null;
  if (input?.repeat && REPEAT_FREQS.includes(input.repeat.freq)) {
    const until = OCC.test(input.repeat.until || '') ? input.repeat.until : '';
    const max = new Date(start.getTime() + 366 * 864e5).toISOString().slice(0, 10);
    repeat = { freq: input.repeat.freq, until: until && until < max ? until : max };
    if (end - start > 864e5) return { success: false, error: 'A repeating event must be shorter than a day.' };
  }

  try {
    if (scope === 'agency' && !privileged(caller)) return { success: false, error: 'Only owners and admins can add agency-wide events.' };
    if (scope === 'team' && !privileged(caller) && !(await isTeamLeader(caller.uid, caller.agencyId))) return { success: false, error: 'Only team heads can add team events.' };

    // Invitees must be real people in this agency.
    let attendeeIds = Array.isArray(input?.attendeeIds) ? [...new Set(input.attendeeIds.map(String))].filter(x => x !== caller.uid).slice(0, 100) : [];
    if (scope !== 'private' || type === 'personal') attendeeIds = [];
    if (attendeeIds.length) {
      const docs = await db.getAll(...attendeeIds.map(id => db.collection('agents').doc(id)));
      attendeeIds = docs.filter(d => d.exists && d.data().agency_id === caller.agencyId).map(d => d.id);
    }

    // A linked lead, client or deal must exist in this agency.
    let related = null;
    if (input?.related && RELATED[input.related.type] && input.related.id) {
      const rs = await db.collection(RELATED[input.related.type]).doc(String(input.related.id)).get();
      if (rs.exists && rs.data().agencyId === caller.agencyId) {
        const r = rs.data();
        related = { type: input.related.type, id: rs.id, name: text(r.clientName || r.leadName || [r.firstName, r.lastName].filter(Boolean).join(' ') || input.related.name, 120) };
      }
    }

    const data = {
      title, type, scope, start: start.toISOString(), end: end.toISOString(), allDay: !!input?.allDay, repeat, tz: safeTz(text(input?.tz, 60)),
      link, location: text(input?.location, 200), notes: text(input?.notes, 2000), attendeeIds, related,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let id; let newlyInvited = attendeeIds;
    if (input?.id) {
      const ref = db.collection('calendarEvents').doc(String(input.id));
      const snap = await ref.get();
      if (!snap.exists || snap.data().agencyId !== caller.agencyId) return { success: false, error: 'Event not found.' };
      if (!canEdit(snap.data(), caller)) return { success: false, error: 'Only the person who created this event can change it.' };
      const before = snap.data();
      newlyInvited = attendeeIds.filter(x => !(before.attendeeIds || []).includes(x));
      // Changing the time clears earlier answers, so people confirm again.
      if (before.start !== data.start || before.end !== data.end) data.rsvp = {};
      await ref.update(data); id = ref.id;
    } else {
      const ref = await db.collection('calendarEvents').add({
        ...data, agencyId: caller.agencyId, createdBy: caller.uid, createdByName: caller.fullName || caller.email, creatorPath: path, rsvp: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      id = ref.id;
    }
    // Tell the people who were just invited (shows on their bell).
    await Promise.all(newlyInvited.map(uid => db.collection('notifications').add({
      userId: uid, agencyId: caller.agencyId, type: 'info', read: false, href: '/dashboard/calendar',
      message: `${caller.fullName || 'A colleague'} invited you to "${title}"`, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => null)));
    return { success: true, id };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Delete an event. With occ (a date) on a repeating event, only that one date is removed. */
export async function deleteCalendarEvent(id, occ) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db } = ctx;
  try {
    const ref = db.collection('calendarEvents').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists || snap.data().agencyId !== caller.agencyId) return { success: false, error: 'Event not found.' };
    if (!canEdit(snap.data(), caller)) return { success: false, error: 'Only the person who created this event can delete it.' };
    if (occ && OCC.test(occ) && snap.data().repeat) {
      await ref.update({ skipDates: getAdminApp().firestore.FieldValue.arrayUnion(occ) });
    } else {
      await ref.delete();
    }
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function loadVisible(id) {
  const ctx = await loadCaller();
  const ref = ctx.db.collection('calendarEvents').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists || snap.data().agencyId !== ctx.caller.agencyId || !canSee(snap.data(), ctx.caller, ctx.path)) return { ...ctx, ref, ev: null };
  return { ...ctx, ref, ev: snap.data() };
}

/** Yes / No / Maybe from anyone who can see the event. An empty answer clears it. */
export async function respondToEvent(id, answer) {
  let x;
  try { x = await loadVisible(id); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!x.ev) return { success: false, error: 'Event not found.' };
  if (answer && !ANSWERS.includes(answer)) return { success: false, error: 'Unknown answer.' };
  try {
    const FieldValue = getAdminApp().firestore.FieldValue;
    await x.ref.update({ [`rsvp.${x.caller.uid}`]: answer || FieldValue.delete() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

/** What happened in the meeting (organiser only), kept per date for repeating events. */
export async function saveEventOutcome(id, occ, body) {
  let x;
  try { x = await loadVisible(id); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!x.ev || !canEdit(x.ev, x.caller)) return { success: false, error: 'Only the organiser can add meeting notes.' };
  if (!OCC.test(occ || '')) return { success: false, error: 'Bad date.' };
  try { await x.ref.update({ [`outcome.${occ}`]: text(body, 4000) }); return { success: true }; } catch (error) { return { success: false, error: error.message }; }
}

/** Who attended (organiser only), kept per date for repeating events. */
export async function saveEventAttendance(id, occ, uids) {
  let x;
  try { x = await loadVisible(id); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!x.ev || !canEdit(x.ev, x.caller)) return { success: false, error: 'Only the organiser can take attendance.' };
  if (!OCC.test(occ || '')) return { success: false, error: 'Bad date.' };
  try {
    const list = Array.isArray(uids) ? [...new Set(uids.map(String))].slice(0, 500) : [];
    await x.ref.update({ [`attendance.${occ}`]: list });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Which of these people already have something on at that time. Returns ids only, never what the event is. */
export async function fetchBusy(ids, startISO, endISO, exceptId) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  const start = validDate(startISO); const end = validDate(endISO);
  const wanted = new Set((Array.isArray(ids) ? ids : []).map(String).slice(0, 200));
  if (!start || !end || !wanted.size) return { success: true, busy: [] };
  try {
    const snap = await ctx.db.collection('calendarEvents').where('agencyId', '==', ctx.caller.agencyId).get();
    const busy = new Set();
    snap.forEach(d => {
      if (d.id === exceptId) return;
      const ev = d.data(); if (ev.allDay) return;
      const who = [ev.createdBy, ...(ev.attendeeIds || [])].filter(u => wanted.has(u) && (ev.rsvp || {})[u] !== 'no');
      if (!who.length) return;
      if (occurrences(ev, start, end).some(o => o.start < end && o.end > start)) who.forEach(u => busy.add(u));
    });
    return { success: true, busy: [...busy] };
  } catch (error) { return { success: false, error: error.message }; }
}

/** The caller's own leads, clients or deals whose name matches, for linking an event to a record. */
export async function searchRecords(type, q) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!RELATED[type]) return { success: false, error: 'Unknown record type.' };
  const { caller, db } = ctx; const needle = text(q, 60).toLowerCase();
  try {
    let query = db.collection(RELATED[type]).where('agencyId', '==', caller.agencyId);
    if (!privileged(caller)) query = query.where(type === 'client' ? 'agentId' : 'ownerAgentId', '==', caller.uid);
    const snap = await query.get();
    const rows = [];
    snap.forEach(d => {
      const r = d.data(); const name = r.clientName || r.leadName || [r.firstName, r.lastName].filter(Boolean).join(' ');
      if (name && (!needle || name.toLowerCase().includes(needle))) rows.push({ id: d.id, name });
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, rows: rows.slice(0, 25) };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Meetings linked to one lead, client or deal (only the ones the caller may see). */
export async function fetchRecordEvents(type, id) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!RELATED[type] || !id) return { success: false, error: 'Unknown record.' };
  const { caller, db, path } = ctx;
  try {
    const snap = await db.collection('calendarEvents').where('agencyId', '==', caller.agencyId).get();
    const from = new Date(Date.now() - 180 * 864e5); const to = new Date(Date.now() + 180 * 864e5); const events = [];
    snap.forEach(d => {
      const ev = d.data();
      if (!ev.related || ev.related.type !== type || ev.related.id !== id || !canSee(ev, caller, path)) return;
      occurrences(ev, from, to).forEach(o => events.push(shape(d.id, ev, o, caller)));
    });
    events.sort((a, b) => a.start.localeCompare(b.start));
    return { success: true, events };
  } catch (error) { return { success: false, error: error.message }; }
}
