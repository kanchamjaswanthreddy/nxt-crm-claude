import { getDisplayName } from '@/lib/constants';
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
          // Same rule as the dashboard banner and the Refresh button: owners, IT and billing-exempt
          // people are skipped; a card counts once Stripe customer, subscription and last four are saved.
          // (This used to look for a `payment_method` field that nothing writes, so it showed 0 completed.)
          if (d.is_owner || d.billingExempt || d.role === 'it_engineer') { exempt++; return; }
          const hasCard = !!(d.stripe_customer_id && d.stripe_subscription_id && d.payment?.cardLastFour);
          const info = {
            id: doc.id,
            name: getDisplayName(d) || d.email || 'Unknown',
            email: d.email || '',
            role: d.role || 'agent',
            status: d.status || 'unknown',
            subscriptionStatus: d.subscriptionStatus || 'none',
            cardLastFour: d.payment?.cardLastFour || null,
          };
          if (hasCard) withCard.push(info); else missing.push(info);
        });
        paymentTracker = { success: true, missing, withCard, withCardCount: withCard.length, exempt, total: snap.size };
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
