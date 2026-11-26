import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

const VALID_CATEGORIES = ['general', 'billing', 'technical', 'compliance', 'onboarding', 'marketing', 'other'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

async function getNextTicketNumber(db, agencyId) {
  try {
    const snap = await db.collection('help_tickets')
      .where('agencyId', '==', agencyId)
      .get();

    if (snap.empty) return 'NXTH-0001';

    let maxNum = 0;
    snap.forEach(doc => {
      const tn = doc.data().ticketNumber || 'NXTH-0000';
      const num = parseInt(tn.replace(/^NXT[H]?-/, ''), 10) || 0;
      if (num > maxNum) maxNum = num;
    });

    return `NXTH-${String(maxNum + 1).padStart(4, '0')}`;
  } catch {
    // Fallback: use timestamp-based ticket number
    return `NXTH-${String(Date.now()).slice(-4)}`;
  }
}

/** GET — fetch tickets for current user */
export async function GET() {
  let caller;
  try { caller = await requireUser(); } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('help_tickets')
      .where('createdBy', '==', caller.uid)
      .get();

    const tickets = [];
    snap.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));
    tickets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST — create a new ticket */
export async function POST(request) {
  let caller;
  try { caller = await requireUser(); } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { subject, description, category, priority, attachments } = body;

  if (!subject?.trim()) return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
  if (!description?.trim()) return NextResponse.json({ success: false, error: 'Description is required' }, { status: 400 });

  const lengthErr = validateLengths([
    [subject, 'Subject', FIELD_LIMITS.subject],
    [description, 'Description', FIELD_LIMITS.description],
  ]);
  if (lengthErr) return NextResponse.json({ success: false, error: lengthErr }, { status: 400 });

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const callerSnap = await db.collection('agents').doc(caller.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};

    const ticketNumber = await getNextTicketNumber(db, caller.agencyId);
    const now = new Date().toISOString();

    const ticketDoc = {
      ticketNumber,
      subject: subject.trim(),
      description: description.trim(),
      category: VALID_CATEGORIES.includes(category) ? category : 'general',
      priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
      status: 'open',
      createdBy: caller.uid,
      createdByName: getDisplayName(callerData) || caller.email,
      createdByEmail: caller.email,
      assignedTo: null,
      assignedToName: null,
      agencyId: caller.agencyId,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      comments: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      closedAt: null,
    };

    const ref = await db.collection('help_tickets').add(ticketDoc);
    return NextResponse.json({ success: true, ticket: { id: ref.id, ...ticketDoc } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
