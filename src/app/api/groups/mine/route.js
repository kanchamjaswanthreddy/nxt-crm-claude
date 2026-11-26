import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

export async function GET() {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('group_members')
      .where('agentId', '==', caller.uid)
      .get();

    const groupIds = snap.docs.map(doc => doc.data().groupId);
    return NextResponse.json({ success: true, groupIds });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
