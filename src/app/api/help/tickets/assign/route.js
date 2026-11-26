import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';

async function checkHelpDeskAccess(caller, db) {
  if (caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer') return true;
  const snap = await db.collection('group_members')
    .where('groupId', '==', 'help-desk')
    .where('agentId', '==', caller.uid)
    .limit(1)
    .get();
  return !snap.empty;
}

/** PUT — assign a ticket to a help desk member */
export async function PUT(request) {
  let caller;
  try { caller = await requireUser(); } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  const hasAccess = await checkHelpDeskAccess(caller, db);
  if (!hasAccess) return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { ticketId, assignedTo, assignedToName } = body;
  if (!ticketId) return NextResponse.json({ success: false, error: 'Ticket ID required' }, { status: 400 });

  try {
    const ticketSnap = await db.collection('help_tickets').doc(ticketId).get();
    if (!ticketSnap.exists) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    if (ticketSnap.data().agencyId !== caller.agencyId) return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });

    await db.collection('help_tickets').doc(ticketId).update({
      assignedTo: assignedTo || null,
      assignedToName: assignedToName || null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
