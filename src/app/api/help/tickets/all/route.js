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

/** GET — fetch all tickets for the agency (help desk only) */
export async function GET() {
  let caller;
  try { caller = await requireUser(); } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  const hasAccess = await checkHelpDeskAccess(caller, db);
  if (!hasAccess) return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });

  try {
    const snap = await db.collection('help_tickets')
      .where('agencyId', '==', caller.agencyId)
      .get();

    const tickets = [];
    snap.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));
    tickets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
