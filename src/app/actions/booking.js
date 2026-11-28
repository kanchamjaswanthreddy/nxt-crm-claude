'use server';

import { headers } from 'next/headers';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { validateEmail, validatePhone, isRateLimited } from '@/lib/validation';
import { occurrences, safeTz, wallToUtc, wallParts, dateKey } from '@/lib/calendarTime';

// Booking page: an agent switches it on and shares /book/<their id>. A visitor (not signed in) sees only
// the agent's name and free times, picks one, and the appointment lands on the agent's calendar.
// The two functions at the bottom are public, so they validate everything and are rate-limited.

const DEFAULTS = { enabled: false, days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 17 * 60, slotMin: 30, tz: 'America/New_York', intro: '' };
const DAYS_AHEAD = 14; const NOTICE_MS = 2 * 36e5;
const text = (v, max) => String(v || '').trim().slice(0, max);
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

function clean(input) {
  const days = Array.isArray(input?.days) ? [...new Set(input.days.map(Number))].filter(d => d >= 0 && d <= 6).sort() : DEFAULTS.days;
  const startMin = clampInt(input?.startMin, 0, 23 * 60, DEFAULTS.startMin);
  const endMin = clampInt(input?.endMin, startMin + 30, 24 * 60, Math.max(startMin + 60, DEFAULTS.endMin));
  return { enabled: !!input?.enabled, days, startMin, endMin, slotMin: [15, 30, 45, 60].includes(Number(input?.slotMin)) ? Number(input.slotMin) : 30, tz: safeTz(text(input?.tz, 60)), intro: text(input?.intro, 300) };
}

export async function fetchBookingSettings() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const snap = await getAdminApp().firestore().collection('bookingSettings').doc(caller.uid).get();
    return { success: true, settings: { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) }, path: `/book/${caller.uid}` };
  } catch (error) { return { success: false, error: error.message }; }
}

export async function saveBookingSettings(input) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const settings = clean(input);
    if (settings.enabled && settings.days.length === 0) return { success: false, error: 'Choose at least one day.' };
    await getAdminApp().firestore().collection('bookingSettings').doc(caller.uid).set({ ...settings, agencyId: caller.agencyId, updatedAt: new Date().toISOString() });
    return { success: true, settings };
  } catch (error) { return { success: false, error: error.message }; }
}

async function loadOpenPage(db, agentId) {
  const id = String(agentId || '');
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(id)) return null;
  const [agentSnap, setSnap] = await Promise.all([db.collection('agents').doc(id).get(), db.collection('bookingSettings').doc(id).get()]);
  if (!agentSnap.exists || !setSnap.exists || !setSnap.data().enabled) return null;
  const agent = agentSnap.data();
  if (agent.status !== 'active') return null;
  return { id, agent, settings: { ...DEFAULTS, ...setSnap.data() } };
}

async function busyIntervals(db, page, from, to) {
  const snap = await db.collection('calendarEvents').where('agencyId', '==', page.agent.agency_id).get();
  const out = [];
  snap.forEach(d => {
    const ev = d.data();
    if (ev.createdBy !== page.id && !(ev.attendeeIds || []).includes(page.id)) return;
    if ((ev.rsvp || {})[page.id] === 'no') return;
    occurrences(ev, from, to).forEach(o => out.push([o.start.getTime(), o.end.getTime()]));
  });
  return out;
}

function freeSlots(settings, busy, now) {
  const tz = settings.tz; const today = wallParts(now, tz); const days = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const noon = wallToUtc(today.y, today.mo, today.d + i, 12, 0, tz); const p = wallParts(noon, tz);
    if (!settings.days.includes(p.wd)) continue;
    const slots = [];
    for (let m = settings.startMin; m + settings.slotMin <= settings.endMin; m += settings.slotMin) {
      const s = wallToUtc(p.y, p.mo, p.d, Math.floor(m / 60), m % 60, tz).getTime(); const e = s + settings.slotMin * 6e4;
      if (s < now.getTime() + NOTICE_MS) continue;
      if (busy.some(([a, b]) => a < e && b > s)) continue;
      slots.push(new Date(s).toISOString());
    }
    if (slots.length) days.push({ day: dateKey(noon, tz), slots });
  }
  return days;
}

/** PUBLIC. What a visitor sees: the agent's name, a short note, and free times for the next two weeks. */
export async function getBookingPage(agentId) {
  try {
    const db = getAdminApp().firestore();
    const page = await loadOpenPage(db, agentId);
    if (!page) return { success: false, error: 'This booking page is not available.' };
    const now = new Date();
    const busy = await busyIntervals(db, page, now, new Date(now.getTime() + (DAYS_AHEAD + 1) * 864e5));
    const name = [page.agent.first_name, page.agent.last_name].filter(Boolean).join(' ') || page.agent.full_name || 'NXT Financial Group';
    return { success: true, name, intro: page.settings.intro, slotMin: page.settings.slotMin, days: freeSlots(page.settings, busy, now) };
  } catch { return { success: false, error: 'This booking page is not available.' }; }
}

/** PUBLIC. Books one free time. Creates the appointment on the agent's calendar and, for a new person, a lead. */
export async function createBooking(agentId, input) {
  const fail = (error) => ({ success: false, error });
  try {
    // A hidden field real people never fill in.
    if (text(input?.website, 50)) return { success: true };
    const h = await headers(); const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (isRateLimited(`booking:${ip}`, 5, 3600000)) return fail('Too many requests. Please try again later.');

    const name = text(input?.name, 80); const email = text(input?.email, 120).toLowerCase(); const phone = text(input?.phone, 30); const note = text(input?.note, 500);
    if (name.length < 2) return fail('Please enter your name.');
    if (!email) return fail('Please enter your email.');
    const emailErr = validateEmail(email); if (emailErr) return fail(emailErr);
    if (phone) { const phoneErr = validatePhone(phone); if (phoneErr) return fail(phoneErr); }

    const admin = getAdminApp(); const db = admin.firestore();
    const page = await loadOpenPage(db, agentId);
    if (!page) return fail('This booking page is not available.');
    const start = new Date(input?.slot);
    if (Number.isNaN(start.getTime())) return fail('Please choose a time.');
    const end = new Date(start.getTime() + page.settings.slotMin * 6e4); const now = new Date();

    // The time must be one this page is offering right now.
    const busy = await busyIntervals(db, page, now, new Date(now.getTime() + (DAYS_AHEAD + 1) * 864e5));
    const offered = freeSlots(page.settings, busy, now).some(d => d.slots.includes(start.toISOString()));
    if (!offered) return fail('That time has just been taken. Please choose another.');

    // Limits: two upcoming bookings per email, forty booked appointments per agent in the window.
    const mine = await db.collection('calendarEvents').where('agencyId', '==', page.agent.agency_id).where('createdBy', '==', page.id).where('source', '==', 'booking').get();
    const upcoming = mine.docs.map(d => d.data()).filter(e => e.end > now.toISOString());
    if (upcoming.filter(e => e.guest?.email === email).length >= 2) return fail('You already have appointments booked. Please contact us to change them.');
    if (upcoming.length >= 40) return fail('No more times can be booked online right now. Please contact us directly.');

    // One slot can only be taken once, even if two people click at the same moment.
    const lockRef = db.collection('bookingLocks').doc(`${page.id}_${start.getTime()}`);
    try { await lockRef.create({ agentId: page.id, at: start.toISOString(), createdAt: now.toISOString() }); } catch { return fail('That time has just been taken. Please choose another.'); }

    const agentName = [page.agent.first_name, page.agent.last_name].filter(Boolean).join(' ') || page.agent.full_name || '';
    const parts = name.split(/\s+/); const firstName = parts[0]; const lastName = parts.slice(1).join(' ') || '-';

    // New person -> a lead for this agent. Someone we already know keeps their existing record.
    let related = null;
    const dup = await db.collection('leads').where('agencyId', '==', page.agent.agency_id).where('email', '==', email).limit(1).get();
    if (!dup.empty) related = { type: 'lead', id: dup.docs[0].id, name };
    else {
      const leadRef = await db.collection('leads').add({
        agencyId: page.agent.agency_id, ownerAgentId: page.id, ownerHierarchyPath: page.agent.hierarchyPath || `/${page.id}`,
        firstName, lastName, email, phone: phone || null, dateOfBirth: null, address: { street: '', city: '', state: '', zip: '' },
        source: 'booking_page', status: 'new', tags: ['booking'], duplicateOfLeadId: null, flagged: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), lastContactedAt: null, createdByAgentId: page.id,
      });
      related = { type: 'lead', id: leadRef.id, name };
    }

    await db.collection('calendarEvents').add({
      agencyId: page.agent.agency_id, title: `Appointment: ${name}`, type: 'client', scope: 'private', start: start.toISOString(), end: end.toISOString(), allDay: false, repeat: null, tz: page.settings.tz,
      link: '', location: '', notes: note, attendeeIds: [], related, rsvp: {}, source: 'booking', guest: { name, email, phone },
      createdBy: page.id, createdByName: agentName, creatorPath: page.agent.hierarchyPath || `/${page.id}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection('notifications').add({ userId: page.id, agencyId: page.agent.agency_id, type: 'info', read: false, href: '/dashboard/calendar', message: `${name} booked an appointment with you`, createdAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => null);
    return { success: true, start: start.toISOString(), end: end.toISOString(), agentName };
  } catch { return fail('Something went wrong. Please try again.'); }
}
