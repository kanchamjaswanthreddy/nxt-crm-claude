import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

async function checkHelpDeskAccess(caller, db) {
  if (caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer') return true;
  const snap = await db.collection('group_members')
    .where('groupId', '==', 'help-desk')
    .where('agentId', '==', caller.uid)
    .limit(1)
    .get();
  return !snap.empty;
}

/** PUT — update ticket status */
export async function PUT(request) {
  let caller;
  try { caller = await requireUser(); } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { ticketId, status } = body;
  if (!ticketId) return NextResponse.json({ success: false, error: 'Ticket ID required' }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const ticketSnap = await db.collection('help_tickets').doc(ticketId).get();
    if (!ticketSnap.exists) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const ticket = ticketSnap.data();
    if (ticket.agencyId !== caller.agencyId) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    const isHelpDesk = await checkHelpDeskAccess(caller, db);
    const isCreator = ticket.createdBy === caller.uid;

    if (!isHelpDesk) {
      if (!isCreator) return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
      if (status !== 'open' || ticket.status !== 'resolved') {
        return NextResponse.json({ success: false, error: 'You can only reopen a resolved ticket' }, { status: 403 });
      }
    }

    const updates = { status, updatedAt: new Date().toISOString() };
    if (status === 'resolved') updates.resolvedAt = new Date().toISOString();
    if (status === 'closed') updates.closedAt = new Date().toISOString();

    await db.collection('help_tickets').doc(ticketId).update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
