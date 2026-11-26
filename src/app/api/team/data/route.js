import { NextResponse } from 'next/server';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';

function cleanDoc(data) {
  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val.toDate === 'function') {
      clean[key] = val.toDate().toISOString();
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function GET() {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const agencyId = caller.agencyId;
  if (!agencyId) {
    return NextResponse.json({ success: false, error: 'No agency ID' }, { status: 400 });
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
  const isSuperAdmin = caller.email === 'kanchamjaswanthreddy@gmail.com';

  try {
    // Parallel fetch: agents, invites, metrics, overrides, w9, payment tracker
    const [agentSnap, inviteSnap] = await Promise.all([
      db.collection('agents').where('agency_id', '==', agencyId).limit(100).get(),
      db.collection('invites').where('agency_id', '==', agencyId).get(),
    ]);

    const agents = [];
    agentSnap.forEach(doc => agents.push({ id: doc.id, ...cleanDoc(doc.data()) }));

    const invites = [];
    inviteSnap.forEach(doc => invites.push({ id: doc.id, ...cleanDoc(doc.data()) }));
    invites.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    // Metrics for current month
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const metricsSnap = await db.collection('AgentMetricsSummary')
      .where('agencyId', '==', agencyId)
      .where('period', '==', yearMonth)
      .get();
    const metrics = [];
    metricsSnap.forEach(doc => metrics.push({ id: doc.id, ...cleanDoc(doc.data()) }));

    // Commission overrides
    const ovSnap = await db.collection('commissionOverrides')
      .where('agencyId', '==', agencyId)
      .get();
    const overrides = [];
    ovSnap.forEach(doc => {
      const data = doc.data();
      overrides.push({
        id: doc.id,
        agentId: data.agentId,
        agentName: data.agentName || '',
        beneficiaryId: data.beneficiaryId,
        beneficiaryName: data.beneficiaryName || '',
        percent: data.percent,
      });
    });

    // W9 status (admin only)
    let w9Map = {};
    if (isPrivileged) {
      const w9Snap = await db.collection('agent_documents')
        .where('agency_id', '==', agencyId)
        .where('document_type', '==', 'w9')
        .get();
      w9Snap.forEach(doc => {
        const d = doc.data();
        if (d.agent_id) {
          w9Map[d.agent_id] = {
            status: d.status || 'pending',
            uploaded_at: d.uploaded_at?.toDate?.()?.toISOString() || d.uploaded_at,
          };
        }
      });
    }

    // Payment tracker (super admin only)
    let paymentTracker = null;
    if (isSuperAdmin) {
      try {
        const snap = await db.collection('agents')
          .where('agency_id', '==', agencyId)
          .get();
        const missing = [];
        const withCard = [];
        let exempt = 0;
        snap.forEach(doc => {
          const d = doc.data();
          if (d.is_owner || d.status === 'invited') { exempt++; return; }
          if (d.payment_method) {
            withCard.push({ id: doc.id, name: [d.first_name, d.last_name].filter(Boolean).join(' ') || d.email });
          } else {
            missing.push({ id: doc.id, name: [d.first_name, d.last_name].filter(Boolean).join(' ') || d.email, email: d.email });
          }
        });
        paymentTracker = { success: true, missing, withCard, exempt };
      } catch {
        paymentTracker = null;
      }
    }

    return NextResponse.json({
      success: true,
      agents,
      invites,
      metrics,
      overrides,
      w9Map,
      paymentTracker,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
