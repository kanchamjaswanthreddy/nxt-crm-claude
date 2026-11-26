import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

async function checkHelpDeskAccess(caller, db) {
  if (caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer') return true;
  const snap = await db.collection('group_members')
    .where('groupId', '==', 'help-desk')
    .where('agentId', '==', caller.uid)
    .limit(1)
    .get();
  return !snap.empty;
}

/** POST — add a comment to a ticket */
export async function POST(request) {
  let caller;
  try { caller = await requireUser(); } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { ticketId, text } = body;
  if (!ticketId) return NextResponse.json({ success: false, error: 'Ticket ID required' }, { status: 400 });
  if (!text?.trim()) return NextResponse.json({ success: false, error: 'Comment text required' }, { status: 400 });

  const lengthErr = validateLengths([[text, 'Comment', FIELD_LIMITS.note]]);
  if (lengthErr) return NextResponse.json({ success: false, error: lengthErr }, { status: 400 });

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const ticketSnap = await db.collection('help_tickets').doc(ticketId).get();
    if (!ticketSnap.exists) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const ticket = ticketSnap.data();
    if (ticket.agencyId !== caller.agencyId) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const isHelpDesk = await checkHelpDeskAccess(caller, db);
    const isCreator = ticket.createdBy === caller.uid;
    if (!isHelpDesk && !isCreator) return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });

    const callerSnap = await db.collection('agents').doc(caller.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};

    const comment = {
      uid: caller.uid,
      name: getDisplayName(callerData) || caller.email,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const existingComments = ticket.comments || [];
    await db.collection('help_tickets').doc(ticketId).update({
      comments: [...existingComments, comment],
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
