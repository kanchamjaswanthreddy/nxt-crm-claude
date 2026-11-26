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
    const doc = await db.collection('agents').doc(caller.uid).get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }
    const data = doc.data();
    const clean = {};
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val.toDate === 'function') {
        clean[key] = val.toDate().toISOString();
      } else {
        clean[key] = val;
      }
    }
    return NextResponse.json({ success: true, profile: clean });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
