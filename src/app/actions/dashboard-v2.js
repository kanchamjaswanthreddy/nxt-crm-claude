'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';

function sanitize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v;
  }
  return out;
}

function safeIso(val) {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  return null;
}

const PRIVILEGED_ROLES = ['admin', 'it_engineer'];

function canSee(deal, agent) {
  if (agent.isOwner || PRIVILEGED_ROLES.includes(agent.role)) return true;
  if (deal.ownerAgentId === agent.uid) return true;
  if (deal.ownerHierarchyPath && agent.hierarchyPath &&
      deal.ownerHierarchyPath.startsWith(agent.hierarchyPath + '/')) return true;
  return false;
}

/**
 * Single server action for dashboard v2. One auth check, one cold start,
 * parallel Firestore reads. Returns plain JSON for both agent and admin views.
 */
export async function fetchDashboardV2Data() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const uid = caller.uid;

  // Load full agent doc for hierarchyPath, upline_id, etc.
  const agentSnap = await db.collection('agents').doc(uid).get();
  if (!agentSnap.exists) return { success: false, error: 'Agent not found' };
  const agent = { uid, ...agentSnap.data() };

  const isPrivileged = agent.is_owner || PRIVILEGED_ROLES.includes(agent.role);
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Last 6 month keys for sparklines
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const queries = [
    /* 0 */ db.collection('AgentMetricsSummary').doc(`${uid}_${yearMonth}`).get(),
    /* 1 */ db.collection('AgentMetricsSummary').doc(`${uid}_all_time`).get(),
    /* 2 */ db.collection('deals')
              .where('agencyId', '==', caller.agencyId)
              .where('status', '==', 'open').get(),
    /* 3 */ db.collection('tasks')
              .where('agencyId', '==', caller.agencyId)
              .where('ownerAgentId', '==', uid)
              .where('status', '==', 'open').get(),
    /* 4 */ db.collection('pipelineStages')
              .where('agencyId', '==', caller.agencyId)
              .orderBy('order', 'asc').get(),
    /* 5 */ agent.upline_id
              ? db.collection('agents').doc(agent.upline_id).get()
              : Promise.resolve(null),
    /* 6-11 */ ...monthKeys.map(mk =>
      db.collection('AgentMetricsSummary').doc(`${uid}_${mk}`).get()
    ),
  ];

  // Admin-only queries appended at indices 12..15
  if (isPrivileged) {
    const prevMonth = monthKeys[monthKeys.length - 2];
    queries.push(
      /* 12 */ db.collection('agents').where('agency_id', '==', caller.agencyId).get(),
      /* 13 */ db.collection('agentRequests')
                 .where('agencyId', '==', caller.agencyId)
                 .where('status', '==', 'pending').get(),
      /* 14 */ db.collection('AgentMetricsSummary')
                 .where('agencyId', '==', caller.agencyId)
                 .where('period', '==', yearMonth).get(),
      /* 15 */ db.collection('AgentMetricsSummary')
                 .where('agencyId', '==', caller.agencyId)
                 .where('period', '==', prevMonth).get(),
    );
  }

  const results = await Promise.all(queries);

  const monthSnap = results[0];
  const dealsSnap = results[2];
  const tasksSnap = results[3];
  const stagesSnap = results[4];
  const uplineSnap = results[5];

  const empty = {
    commissionPending: 0, commissionConfirmed: 0, commissionPaid: 0,
    overrideEarnedPending: 0, overrideEarnedConfirmed: 0, overrideEarnedPaid: 0,
    dealsWonCount: 0, dealsWonPremiumTotal: 0, dealsLostCount: 0, dealsOpenCount: 0,
    leadsAssignedCount: 0, leadsConvertedCount: 0,
    tasksCompletedCount: 0, tasksOverdueCurrentCount: 0,
  };

  const monthMetrics = monthSnap.exists ? sanitize(monthSnap.data()) : { ...empty };

  // Sparkline arrays (last 6 months)
  const sparkProduction = monthKeys.map((_, i) => {
    const s = results[6 + i];
    if (!s.exists) return 0;
    const d = s.data();
    return (d.commissionPaid || 0) + (d.overrideEarnedPaid || 0);
  });
  const sparkDeals = monthKeys.map((_, i) => {
    const s = results[6 + i];
    return s.exists ? (s.data().dealsWonCount || 0) : 0;
  });

  // Pipeline stages
  const stages = [];
  stagesSnap.forEach(doc => {
    const d = doc.data();
    if (!d.archived) {
      stages.push({
        id: doc.id, name: d.name,
        isWonStage: !!d.isWonStage, isLostStage: !!d.isLostStage,
      });
    }
  });

  // Deals (visibility-filtered)
  const visibleDeals = [];
  dealsSnap.forEach(doc => {
    const data = doc.data();
    if (canSee({ ...data, id: doc.id }, agent)) {
      visibleDeals.push({
        id: doc.id,
        stageId: data.stageId,
        premiumAmount: data.premiumAmount || 0,
        ownerAgentId: data.ownerAgentId,
        createdAt: safeIso(data.createdAt),
      });
    }
  });

  const myDeals = visibleDeals.filter(d => d.ownerAgentId === uid);
  const dealsForPipeline = isPrivileged ? visibleDeals : myDeals;

  const pipelineByStage = stages
    .filter(s => !s.isWonStage && !s.isLostStage)
    .map(s => ({
      stageId: s.id,
      name: s.name,
      count: dealsForPipeline.filter(d => d.stageId === s.id).length,
      value: dealsForPipeline.filter(d => d.stageId === s.id)
        .reduce((sum, d) => sum + d.premiumAmount, 0),
    }));

  // Tasks
  const tasks = [];
  tasksSnap.forEach(doc => {
    const d = sanitize(doc.data());
    tasks.push({
      id: doc.id,
      title: d.title,
      dueAt: d.dueAt,
      priority: d.priority,
    });
  });
  tasks.sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''));

  const nowMs = now.getTime();
  const overdueCount = tasks.filter(t => t.dueAt && new Date(t.dueAt).getTime() < nowMs).length;

  const mtdProduction = (monthMetrics.commissionPaid || 0) + (monthMetrics.overrideEarnedPaid || 0);
  const mtdPending = (monthMetrics.commissionPending || 0) + (monthMetrics.overrideEarnedPending || 0);

  // Month-over-month comparison for featured card
  const prevMonthProd = sparkProduction[sparkProduction.length - 2] || 0;
  const curMonthProd = sparkProduction[sparkProduction.length - 1] || 0;
  let momPct = null;
  if (prevMonthProd > 0) {
    momPct = Math.round(((curMonthProd - prevMonthProd) / prevMonthProd) * 100);
  }

  // ── Recruitment leaderboard (top 3, visible to all) ──
  const allAgentsSnap = isPrivileged
    ? null  // admin path fetches agents separately below
    : await db.collection('agents').where('agency_id', '==', caller.agencyId).get();

  const result = {
    success: true,
    agent: {
      fullName: getDisplayName(agent),
      role: agent.role,
      isOwner: !!agent.is_owner,
      isPrivileged,
      contractLevel: agent.contractLevel || '',
      documentsUploaded: !!agent.onboardingProgress?.documentsUploaded,
      hasNpn: !!agent.npn,
      hasEO: !!agent.compliance?.has_eo,
      onboardingCompleted: !!agent.onboarding_completed_at,
    },
    kpis: {
      mtdProduction,
      mtdPending,
      pipelineValue: myDeals.reduce((s, d) => s + d.premiumAmount, 0),
      dealsWonMonth: monthMetrics.dealsWonCount || 0,
      overdueTaskCount: overdueCount,
      sparkProduction,
      sparkDeals,
      momPct,
    },
    pipelineByStage,
    tasks,
    uplineName: uplineSnap?.exists ? getDisplayName(uplineSnap.data()) : null,
  };

  // ── Admin extras ──
  if (isPrivileged) {
    const adminBase = 6 + monthKeys.length;
    const teamSnap = results[adminBase];
    const reqSnap = results[adminBase + 1];
    const agencyMetricsSnap = results[adminBase + 2];
    const prevAgencyMetricsSnap = results[adminBase + 3];

    let agencyMtdProduction = 0;
    let agencyDealsWon = 0;
    let agencyDealsWonPremium = 0;
    agencyMetricsSnap.forEach(doc => {
      const d = doc.data();
      agencyMtdProduction += (d.commissionPaid || 0) + (d.overrideEarnedPaid || 0);
      agencyDealsWon += d.dealsWonCount || 0;
      agencyDealsWonPremium += d.dealsWonPremiumTotal || 0;
    });

    // Previous month agency production for comparison
    let prevAgencyMtdProduction = 0;
    prevAgencyMetricsSnap.forEach(doc => {
      const d = doc.data();
      prevAgencyMtdProduction += (d.commissionPaid || 0) + (d.overrideEarnedPaid || 0);
    });
    let agencyMomPct = null;
    if (prevAgencyMtdProduction > 0) {
      agencyMomPct = Math.round(((agencyMtdProduction - prevAgencyMtdProduction) / prevAgencyMtdProduction) * 100);
    }

    let pendingInvites = 0;
    let pendingApprovals = 0;
    let activeCount = 0;
    let onboardingCount = 0;
    let oldestInviteDays = 0;
    let teamSize = 0;
    const needsAttention = [];
    const docsAwaitingReview = [];
    const agentMap = {};
    const onboardingAgents = [];

    teamSnap.forEach(doc => {
      teamSize++;
      const d = doc.data();
      agentMap[doc.id] = {
        fullName: getDisplayName(d),
        contractLevel: d.contractLevel || '',
        photoUrl: d.photo_url || '',
      };

      if (d.status === 'active') activeCount++;
      if (d.status === 'invited') pendingInvites++;
      if (d.status === 'pending_approval') pendingApprovals++;
      if (['invited', 'pending_approval', 'pending_licensing'].includes(d.status)) {
        onboardingCount++;
      }

      // Oldest pending invite
      if (d.status === 'invited' && d.created_at) {
        const invDays = Math.floor((nowMs - new Date(d.created_at).getTime()) / 86400000);
        if (invDays > oldestInviteDays) oldestInviteDays = invDays;
      }

      // Docs awaiting review
      if (d.onboardingProgress?.documentsUploaded && !d.onboardingProgress?.documentsApproved) {
        docsAwaitingReview.push({ id: doc.id, fullName: getDisplayName(d) });
      }

      // Needs attention (stuck > 7 days)
      if (['invited', 'pending_approval', 'pending_licensing'].includes(d.status)
          && !d.onboarding_completed_at && d.created_at) {
        const days = Math.floor((nowMs - new Date(d.created_at).getTime()) / 86400000);
        if (days > 7) {
          needsAttention.push({ id: doc.id, fullName: getDisplayName(d), status: d.status, days });
        }
      }

      // Onboarding agents (for needs-attention empty state)
      if (!d.onboarding_completed_at
          && ['invited', 'pending_approval', 'pending_licensing'].includes(d.status)) {
        let steps = 0;
        if (d.onboardingProgress?.documentsUploaded) steps++;
        if (d.npn) steps++;
        if (d.compliance?.has_eo) steps++;
        if (d.onboardingProgress?.documentsApproved) steps++;
        onboardingAgents.push({
          id: doc.id, name: getDisplayName(d),
          progress: Math.round((steps / 4) * 100),
        });
      }
    });

    // Top 5 producers from current month agency metrics
    const producerEntries = [];
    agencyMetricsSnap.forEach(doc => {
      const d = doc.data();
      const agentId = doc.id.substring(0, doc.id.lastIndexOf('_'));
      const production = (d.commissionPaid || 0) + (d.overrideEarnedPaid || 0);
      producerEntries.push({
        agentId, production,
        premium: d.dealsWonPremiumTotal || 0,
      });
    });
    const topProducers = producerEntries
      .filter(p => p.production > 0 && agentMap[p.agentId])
      .sort((a, b) => b.production - a.production)
      .slice(0, 5)
      .map((p, i) => ({
        id: p.agentId,
        name: agentMap[p.agentId].fullName,
        level: agentMap[p.agentId].contractLevel,
        photoUrl: agentMap[p.agentId].photoUrl,
        production: p.production,
        rank: i + 1,
      }));

    // Recent activity from existing data (agents + deals)
    const recentActivity = [];
    const thirtyDaysMs = 30 * 86400000;

    teamSnap.forEach(doc => {
      const d = doc.data();
      const createdAt = safeIso(d.created_at);
      if (createdAt && nowMs - new Date(createdAt).getTime() < thirtyDaysMs) {
        recentActivity.push({
          type: 'agent_invited', actor: getDisplayName(d) || 'Agent',
          text: 'was invited to the team', timestamp: createdAt,
        });
      }
      const approvedAt = safeIso(d.approved_at);
      if (approvedAt && nowMs - new Date(approvedAt).getTime() < thirtyDaysMs) {
        recentActivity.push({
          type: 'agent_approved', actor: getDisplayName(d) || 'Agent',
          text: 'was approved', timestamp: approvedAt,
        });
      }
      const onboardedAt = safeIso(d.onboarding_completed_at);
      if (onboardedAt && nowMs - new Date(onboardedAt).getTime() < thirtyDaysMs) {
        recentActivity.push({
          type: 'agent_activated', actor: getDisplayName(d) || 'Agent',
          text: 'completed onboarding', timestamp: onboardedAt,
        });
      }
    });

    // Deal creation events from open deals
    visibleDeals.forEach(deal => {
      if (deal.createdAt && nowMs - new Date(deal.createdAt).getTime() < thirtyDaysMs) {
        const name = agentMap[deal.ownerAgentId]?.fullName || 'Agent';
        recentActivity.push({
          type: 'deal_created', actor: name,
          text: 'created a deal', timestamp: deal.createdAt,
        });
      }
    });

    recentActivity.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    const pendingRequests = [];
    reqSnap.forEach(doc => {
      const d = sanitize(doc.data());
      pendingRequests.push({
        id: doc.id, title: d.title,
        targetAgentId: d.targetAgentId,
        requestType: d.requestType,
        createdByName: d.createdByName,
      });
    });

    result.admin = {
      teamSize,
      activeCount,
      onboardingCount,
      pendingInvites,
      pendingApprovals,
      oldestInviteDays,
      agencyMtdProduction,
      agencyDealsWon,
      agencyDealsWonPremium,
      agencyPipelineValue: visibleDeals.reduce((s, d) => s + d.premiumAmount, 0),
      openDealCount: visibleDeals.length,
      agencyMomPct,
      needsAttention,
      docsAwaitingReview,
      pendingRequests,
      topProducers,
      recentActivity: recentActivity.slice(0, 8),
      recentlyOnboarding: onboardingAgents.slice(0, 3),
    };
  }

  // ── Top recruiters (visible to ALL agents) ──
  {
    const snap = isPrivileged ? results[6 + monthKeys.length] : allAgentsSnap;
    const rcMap = {};
    const riMap = {};
    const ownerIds = new Set();
    snap.forEach(doc => {
      const d = doc.data();
      riMap[doc.id] = {
        name: getDisplayName(d) || d.preferred_name || d.email || 'Unknown',
        photoUrl: d.photo_url || null,
      };
      if (d.is_owner) ownerIds.add(doc.id);
      if (d.upline_id) {
        rcMap[d.upline_id] = (rcMap[d.upline_id] || 0) + 1;
      }
    });

    result.topRecruiters = Object.entries(rcMap)
      .filter(([id]) => riMap[id] && !ownerIds.has(id))
      .map(([id, count]) => ({ id, name: riMap[id].name, photoUrl: riMap[id].photoUrl, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  return result;
}
