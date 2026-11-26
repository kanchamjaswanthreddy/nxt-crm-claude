import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { getDisplayName } from '@/lib/constants';

async function checkHelpDeskAccess(caller, db) {
  if (caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer') return true;
  const snap = await db.collection('group_members')
    .where('groupId', '==', 'help-desk')
    .where('agentId', '==', caller.uid)
    .limit(1)
    .get();
  return !snap.empty;
}

/** GET — list help desk members for assignment dropdown */
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
    const memberSnap = await db.collection('group_members')
      .where('groupId', '==', 'help-desk')
      .get();

    const members = [];
    for (const doc of memberSnap.docs) {
      const agentSnap = await db.collection('agents').doc(doc.data().agentId).get();
      if (agentSnap.exists && agentSnap.data().agency_id === caller.agencyId) {
        members.push({
          id: agentSnap.id,
          name: getDisplayName(agentSnap.data()) || agentSnap.data().email,
        });
      }
    }

    // Also include admins/owners/IT
    const adminSnap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    adminSnap.forEach(doc => {
      const data = doc.data();
      if (data.is_owner || data.role === 'admin' || data.role === 'it_engineer') {
        if (!members.find(m => m.id === doc.id)) {
          members.push({
            id: doc.id,
            name: getDisplayName(data) || data.email,
          });
        }
      }
    });

    return NextResponse.json({ success: true, members });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
