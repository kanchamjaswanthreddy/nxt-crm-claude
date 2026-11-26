import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUserFromRequest } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

function escapeCsv(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toIso(val) {
  if (!val) return '';
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return '';
}

export async function GET(request) {
  try {
    // --- Authenticate via session cookie ---
    let caller;
    try {
      caller = await requireUserFromRequest(request);
    } catch {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const admin = getAdminApp();
    const db = admin.firestore();

    const isPrivileged = caller.isOwner || ['admin', 'it_engineer'].includes(caller.role);

    const { searchParams } = new URL(request.url);

    // --- Parse params ---
    const startDate = searchParams.get('start') || null;
    const endDate = searchParams.get('end') || null;
    const period = searchParams.get('period') || 'all_time';

    // Compute bounds from period if no explicit dates
    let startBound = startDate ? new Date(startDate) : null;
    let endBound = endDate ? new Date(endDate) : new Date();

    if (!startDate && period !== 'all_time') {
      const now = new Date();
      if (period === 'this_month') startBound = new Date(now.getFullYear(), now.getMonth(), 1);
      else if (period === 'quarter') startBound = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      else if (period === 'ytd') startBound = new Date(now.getFullYear(), 0, 1);
      else if (period === 'last_12') startBound = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }

    // --- Fetch deals + agents + carriers + caller's full doc in parallel ---
    const [dealSnap, agentSnap, carrierSnap, callerDoc] = await Promise.all([
      db.collection('deals').where('agencyId', '==', caller.agencyId).get(),
      db.collection('agents').where('agency_id', '==', caller.agencyId).get(),
      db.collection('carriers').where('agencyId', '==', caller.agencyId).get(),
      db.collection('agents').doc(caller.uid).get(),
    ]);
    const agent = { uid: caller.uid, ...(callerDoc.exists ? callerDoc.data() : {}) };

    const agentNames = {};
    agentSnap.forEach(doc => {
      const d = doc.data();
      agentNames[doc.id] = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(' ') || d.full_name || d.email || '';
    });

    const carrierNames = {};
    carrierSnap.forEach(doc => {
      carrierNames[doc.id] = doc.data().name || '';
    });

    // --- Build CSV rows ---
    const header = ['Deal ID', 'Agent', 'Client / Lead', 'Policy Type', 'Carrier', 'Premium', 'Status', 'Created', 'Closed'];
    const rows = [header];

    dealSnap.forEach(doc => {
      const d = doc.data();

      // Visibility check
      if (!isPrivileged) {
        if (d.ownerAgentId !== agent.uid) {
          if (!d.ownerHierarchyPath || !agent.hierarchyPath ||
              !d.ownerHierarchyPath.startsWith(agent.hierarchyPath + '/')) {
            return;
          }
        }
      }

      // Date filter
      const createdIso = toIso(d.createdAt);
      const dateField = d.status === 'won' ? (toIso(d.updatedAt) || createdIso) : createdIso;
      if (startBound && new Date(dateField) < startBound) return;
      if (endBound && new Date(dateField) > endBound) return;

      const closedDate = (d.status === 'won' || d.status === 'lost') ? (toIso(d.updatedAt) || '') : '';

      rows.push([
        doc.id,
        agentNames[d.ownerAgentId] || d.ownerAgentId || '',
        d.leadId || '',
        d.policyType || '',
        carrierNames[d.carrierId] || d.carrierId || '',
        d.premiumAmount || 0,
        d.status || '',
        createdIso,
        closedDate,
      ]);
    });

    const csvString = rows.map(row => row.map(escapeCsv).join(',')).join('\n');

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="deals_export_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('[reports/export] Error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
