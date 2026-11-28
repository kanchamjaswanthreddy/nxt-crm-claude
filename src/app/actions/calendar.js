'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, isTeamLeader } from '@/lib/serverAuth';

// Shared calendar. Events live in `calendarEvents` and are only ever read or written here, on the server.
//   scope 'agency'  : everyone in the agency sees it (owners and admins create these)
//   scope 'team'    : the creator and everyone under them (team heads, owners and admins create these)
//   scope 'private' : the creator, the people they invite, and the creator's uplines
// Times are stored as ISO strings in UTC; each browser shows them in its own time zone.

const TYPES = ['meeting', 'training', 'client', 'personal'];
const SCOPES = ['agency', 'team', 'private'];
const privileged = (u) => u.isOwner || u.role === 'admin' || u.role === 'it_engineer';
const text = (v, max) => String(v || '').trim().slice(0, max);
const validDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

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

const shape = (id, ev, caller) => ({
  id, title: ev.title, type: ev.type, scope: ev.scope, start: ev.start, end: ev.end, allDay: !!ev.allDay,
  link: ev.link || '', location: ev.location || '', notes: ev.notes || '',
  createdBy: ev.createdBy, createdByName: ev.createdByName || '', attendeeIds: ev.attendeeIds || [],
  canEdit: ev.createdBy === caller.uid || privileged(caller),
});

/** Everything the caller may see between two dates, plus their own open tasks that are due in that window. */
export async function fetchCalendar(fromISO, toISO) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db, path } = ctx;
  const from = validDate(fromISO); const to = validDate(toISO);
  if (!from || !to) return { success: false, error: 'Bad date range.' };
  try {
    const [evSnap, taskSnap, leader] = await Promise.all([
      db.collection('calendarEvents').where('agencyId', '==', caller.agencyId).get(),
      db.collection('tasks').where('agencyId', '==', caller.agencyId).where('ownerAgentId', '==', caller.uid).get(),
      isTeamLeader(caller.uid, caller.agencyId),
    ]);
    const events = [];
    evSnap.forEach(d => {
      const ev = d.data();
      if (ev.end < from.toISOString() || ev.start > to.toISOString()) return;
      if (canSee(ev, caller, path)) events.push(shape(d.id, ev, caller));
    });
    const tasks = [];
    taskSnap.forEach(d => {
      const t = d.data(); const due = t.dueAt?.toDate?.();
      if (!due || t.status === 'done' || t.status === 'completed' || due < from || due > to) return;
      tasks.push({ id: d.id, title: t.title || 'Task', due: due.toISOString() });
    });
    events.sort((a, b) => a.start.localeCompare(b.start));
    return { success: true, events, tasks, me: caller.uid, scopes: privileged(caller) ? SCOPES : leader ? ['team', 'private'] : ['private'] };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Create (no id) or update (id) an event. */
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

  try {
    if (scope === 'agency' && !privileged(caller)) return { success: false, error: 'Only owners and admins can add agency-wide events.' };
    if (scope === 'team' && !privileged(caller) && !(await isTeamLeader(caller.uid, caller.agencyId))) return { success: false, error: 'Only team heads can add team events.' };

    // Invitees must be real people in this agency.
    let attendeeIds = Array.isArray(input?.attendeeIds) ? [...new Set(input.attendeeIds.map(String))].filter(x => x !== caller.uid).slice(0, 100) : [];
    if (scope !== 'private') attendeeIds = [];
    if (attendeeIds.length) {
      const refs = attendeeIds.map(id => db.collection('agents').doc(id));
      const docs = await db.getAll(...refs);
      attendeeIds = docs.filter(d => d.exists && d.data().agency_id === caller.agencyId).map(d => d.id);
    }

    const data = {
      title, type, scope, start: start.toISOString(), end: end.toISOString(), allDay: !!input?.allDay,
      link, location: text(input?.location, 200), notes: text(input?.notes, 2000), attendeeIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (input?.id) {
      const ref = db.collection('calendarEvents').doc(String(input.id));
      const snap = await ref.get();
      if (!snap.exists || snap.data().agencyId !== caller.agencyId) return { success: false, error: 'Event not found.' };
      if (snap.data().createdBy !== caller.uid && !privileged(caller)) return { success: false, error: 'Only the person who created this event can change it.' };
      await ref.update(data);
      return { success: true, id: ref.id };
    }
    const ref = await db.collection('calendarEvents').add({
      ...data, agencyId: caller.agencyId, createdBy: caller.uid, createdByName: caller.fullName || caller.email, creatorPath: path,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, id: ref.id };
  } catch (error) { return { success: false, error: error.message }; }
}

export async function deleteCalendarEvent(id) {
  let ctx;
  try { ctx = await loadCaller(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db } = ctx;
  try {
    const ref = db.collection('calendarEvents').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists || snap.data().agencyId !== caller.agencyId) return { success: false, error: 'Event not found.' };
    if (snap.data().createdBy !== caller.uid && !privileged(caller)) return { success: false, error: 'Only the person who created this event can delete it.' };
    await ref.delete();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}
