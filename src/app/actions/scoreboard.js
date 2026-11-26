'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';

export async function fetchScoreboard(period = 'all_time') {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Determine period suffix for doc IDs
    let periodSuffix = period;
    if (period === 'this_month') {
      const now = new Date();
      periodSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'last_month') {
      const now = new Date();
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      periodSuffix = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'ytd') {
      // For YTD we need to aggregate all months in the current year
      periodSuffix = null;
    }

    let metrics = [];

    if (periodSuffix === null) {
      // YTD: fetch all monthly docs for this year
      const year = new Date().getFullYear();
      const snap = await db.collection('AgentMetricsSummary')
        .where('agencyId', '==', caller.agencyId)
        .get();

      const agentMap = {};
      snap.forEach(doc => {
        const data = doc.data();
        if (data.period === 'all_time') return;
        if (!data.period.startsWith(String(year))) return;

        if (!agentMap[data.agentId]) {
          agentMap[data.agentId] = {
            agentId: data.agentId,
            dealsWonCount: 0,
            dealsWonPremiumTotal: 0,
            commissionPaid: 0,
            overrideEarnedPaid: 0,
            leadsConvertedCount: 0,
            tasksCompletedCount: 0,
          };
        }
        const a = agentMap[data.agentId];
        a.dealsWonCount += data.dealsWonCount || 0;
        a.dealsWonPremiumTotal += data.dealsWonPremiumTotal || 0;
        a.commissionPaid += data.commissionPaid || 0;
        a.overrideEarnedPaid += data.overrideEarnedPaid || 0;
        a.leadsConvertedCount += data.leadsConvertedCount || 0;
        a.tasksCompletedCount += data.tasksCompletedCount || 0;
      });
      metrics = Object.values(agentMap);
    } else {
      // Single period: fetch docs matching the period
      const snap = await db.collection('AgentMetricsSummary')
        .where('agencyId', '==', caller.agencyId)
        .where('period', '==', periodSuffix)
        .get();

      snap.forEach(doc => {
        const data = doc.data();
        metrics.push({
          agentId: data.agentId,
          dealsWonCount: data.dealsWonCount || 0,
          dealsWonPremiumTotal: data.dealsWonPremiumTotal || 0,
          commissionPaid: data.commissionPaid || 0,
          overrideEarnedPaid: data.overrideEarnedPaid || 0,
          leadsConvertedCount: data.leadsConvertedCount || 0,
          tasksCompletedCount: data.tasksCompletedCount || 0,
        });
      });
    }

    // Fetch agent names
    const agentIds = [...new Set(metrics.map(m => m.agentId))];
    const agentNames = {};
    const chunks = [];
    for (let i = 0; i < agentIds.length; i += 10) {
      chunks.push(agentIds.slice(i, i + 10));
    }
    await Promise.all(chunks.map(async (chunk) => {
      const agentSnaps = await Promise.all(
        chunk.map(id => db.collection('agents').doc(id).get())
      );
      agentSnaps.forEach(snap => {
        if (snap.exists) {
          const d = snap.data();
          agentNames[snap.id] = getDisplayName(d) || d.email;
        }
      });
    }));

    const enriched = metrics.map(m => ({
      ...m,
      agentName: agentNames[m.agentId] || 'Unknown Agent',
    }));

    return { success: true, scoreboard: enriched };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchAgentsForScoreboard() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const agents = [];
    snap.forEach(doc => {
      const data = doc.data();
      agents.push({
        id: doc.id,
        full_name: getDisplayName(data),
        email: data.email || '',
        role: data.role || 'agent',
        upline_id: data.upline_id || null,
        is_owner: data.is_owner || false,
        hierarchyPath: data.hierarchyPath || '',
      });
    });

    return { success: true, agents };
  } catch (error) {
    return { success: false, error: error.message, agents: [] };
  }
}
