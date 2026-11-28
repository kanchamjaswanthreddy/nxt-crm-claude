import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { occurrences } from '@/lib/calendarTime';
import { sendScheduleEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

// Once a day (11:00 UTC, early morning in the US): email each person the events on their calendar
// for the next 24 hours. Agency events go to everyone active, team events to the organiser's team,
// private events to the organiser and the people invited. Anyone who answered "No" is left out.
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new NextResponse('Internal Server Error', { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const db = getAdminApp().firestore();
    const from = new Date(); const to = new Date(from.getTime() + 864e5);
    const [evSnap, agentSnap] = await Promise.all([db.collection('calendarEvents').get(), db.collection('agents').where('status', '==', 'active').get()]);
    const agents = agentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const perPerson = new Map();

    evSnap.forEach(d => {
      const ev = d.data(); if (ev.type === 'personal') return;
      const hits = occurrences(ev, from, to).filter(o => o.start >= from);
      if (!hits.length) return;
      const inAgency = agents.filter(a => a.agency_id === ev.agencyId);
      let people;
      if (ev.scope === 'agency') people = inAgency;
      else if (ev.scope === 'team') people = inAgency.filter(a => a.id === ev.createdBy || (a.hierarchyPath || '').includes(`/${ev.createdBy}/`));
      else people = inAgency.filter(a => a.id === ev.createdBy || (ev.attendeeIds || []).includes(a.id));
      people.filter(a => (ev.rsvp || {})[a.id] !== 'no').forEach(a => {
        if (!perPerson.has(a.id)) perPerson.set(a.id, { agent: a, items: [] });
        hits.forEach(o => perPerson.get(a.id).items.push({ at: o.start, tz: ev.tz || 'America/New_York', allDay: !!ev.allDay, title: ev.title, link: ev.link || '' }));
      });
    });

    let sent = 0; let failed = 0;
    for (const { agent, items } of perPerson.values()) {
      if (!agent.email) continue;
      items.sort((a, b) => a.at - b.at);
      const tz = items[0].tz;
      try {
        await sendScheduleEmail({
          to: agent.email,
          name: [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.full_name || '',
          dayLabel: from.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }),
          items: items.map(i => ({ title: i.title, link: i.link, when: i.allDay ? 'All day' : `${i.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: i.tz, timeZoneName: 'short' })}` })),
        });
        sent += 1;
      } catch (err) { failed += 1; console.error('calendar reminder failed for', agent.id, err?.message); }
    }
    return NextResponse.json({ success: true, people: perPerson.size, sent, failed });
  } catch (error) {
    console.error('calendar-reminders cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
