import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';

export const dynamic = 'force-dynamic';

// Once a week: clear deleted and edited message originals (and their files) that are older than the
// agency's retention period. Live messages and the review access log are never touched here.
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new NextResponse('Internal Server Error', { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const admin = getAdminApp(); const db = admin.firestore();
    const [convs, settings] = await Promise.all([db.collection('conversations').get(), db.collection('chatCompliance').get()]);
    const years = {}; settings.forEach(d => { years[d.id] = d.data().retentionYears || 7; });
    let cleared = 0;
    for (const c of convs.docs) {
      const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - (years[c.data().agencyId] || 7));
      const old = await c.ref.collection('archive').where('at', '<', cutoff.toISOString()).limit(300).get();
      for (const d of old.docs) {
        if (d.data().file?.path) await admin.storage().file(d.data().file.path).delete().catch(() => {});
        await d.ref.delete(); cleared += 1;
      }
    }
    return NextResponse.json({ success: true, cleared });
  } catch (error) {
    console.error('chat-retention failed', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
