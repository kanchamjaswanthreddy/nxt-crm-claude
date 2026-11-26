'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';

/** Convert Firestore Timestamps to ISO strings. */
function sanitize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v;
  }
  return out;
}

const PRIVILEGED_ROLES = ['admin', 'it_engineer'];

/**
 * Return true when the caller can see this deal.
 */
function canSee(deal, caller) {
  if (caller.isOwner || PRIVILEGED_ROLES.includes(caller.role)) return true;
  if (deal.ownerAgentId === caller.uid) return true;
  if (deal.ownerHierarchyPath && caller.hierarchyPath && deal.ownerHierarchyPath.startsWith(caller.hierarchyPath + '/')) return true;
  return false;
}

/**
 * Fetch deals visible to the caller, with optional server-side type filter.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.policyTypes]  - e.g. ['life','critical','disability']
 * @param {boolean}  [opts.isRenewal]    - filter to renewals only
 * @param {string}   [opts.status]       - e.g. 'open'
 */
export async function fetchDealsForUser(opts = {}) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  // Load agent doc for hierarchyPath
  const agentSnap = await db.collection('agents').doc(caller.uid).get();
  if (!agentSnap.exists) return { success: false, error: 'Agent not found' };
  const agentData = agentSnap.data();
  const callerWithPath = { ...caller, hierarchyPath: agentData.hierarchyPath || '' };

  let q = db.collection('deals').where('agencyId', '==', caller.agencyId);

  // Server-side type filters
  if (opts.policyTypes && opts.policyTypes.length > 0) {
    q = q.where('policyType', 'in', opts.policyTypes);
  }
  if (opts.isRenewal === true) {
    q = q.where('isRenewal', '==', true);
  }
  if (opts.status) {
    q = q.where('status', '==', opts.status);
  }

  const snap = await q.get();
  const deals = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (canSee({ ...data, id: doc.id }, callerWithPath)) {
      deals.push({ id: doc.id, ...sanitize(data) });
    }
  });

  return { success: true, deals };
}

/**
 * Fetch agent name map for the agency (id → { full_name, firstName, lastName }).
 */
export async function fetchAgentNameMap() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const snap = await db.collection('agents').where('agency_id', '==', caller.agencyId).get();
  const map = {};
  snap.forEach(doc => {
    const d = doc.data();
    map[doc.id] = {
      full_name: getDisplayName(d),
      firstName: d.first_name || d.full_name?.split(' ')[0] || '',
      lastName: d.last_name || d.full_name?.split(' ').slice(1).join(' ') || '',
    };
  });

  return { success: true, agentMap: map };
}

/**
 * Fetch dashboard summary data: open deals, upcoming tasks, agent metrics.
 */
export async function fetchDashboardData() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const uid = caller.uid;

  // Load full agent doc
  const agentDocSnap = await db.collection('agents').doc(uid).get();
  if (!agentDocSnap.exists) return { success: false, error: 'Agent not found' };
  const agent = agentDocSnap.data();

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Run independent reads in parallel
  const [
    metricsAllSnap,
    metricsMonthSnap,
    dealsSnap,
    tasksSnap,
    uplineSnap,
  ] = await Promise.all([
    db.collection('AgentMetricsSummary').doc(`${uid}_all_time`).get(),
    db.collection('AgentMetricsSummary').doc(`${uid}_${yearMonth}`).get(),
    db.collection('deals')
      .where('agencyId', '==', caller.agencyId)
      .where('ownerAgentId', '==', uid)
      .where('status', '==', 'open')
      .get(),
    db.collection('tasks')
      .where('agencyId', '==', caller.agencyId)
      .where('ownerAgentId', '==', uid)
      .where('status', '==', 'open')
      .get(),
    agent.upline_id ? db.collection('agents').doc(agent.upline_id).get() : Promise.resolve(null),
  ]);

  const metricsAll = metricsAllSnap.exists ? sanitize(metricsAllSnap.data()) : {};
  const metricsMonth = metricsMonthSnap.exists ? sanitize(metricsMonthSnap.data()) : {};

  const openDeals = [];
  dealsSnap.forEach(doc => openDeals.push({ id: doc.id, ...sanitize(doc.data()) }));

  const openTasks = [];
  tasksSnap.forEach(doc => openTasks.push({ id: doc.id, ...sanitize(doc.data()) }));

  // For admins, also fetch team agents
  let teamAgents = null;
  if (caller.isOwner || PRIVILEGED_ROLES.includes(caller.role)) {
    const teamSnap = await db.collection('agents').where('agency_id', '==', caller.agencyId).get();
    teamAgents = [];
    teamSnap.forEach(doc => {
      const d = doc.data();
      teamAgents.push({ id: doc.id, full_name: getDisplayName(d), role: d.role, status: d.status });
    });
  }

  return {
    success: true,
    metricsAll,
    metricsMonth,
    openDeals,
    openTasks,
    uplineName: uplineSnap?.exists ? getDisplayName(uplineSnap.data()) : null,
    teamAgents,
  };
}

/**
 * Fetch all data needed by the New Businesses page in a single server action.
 */
export async function fetchDealsPageData() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  // Load agent doc for hierarchyPath
  const agentDocSnap = await db.collection('agents').doc(caller.uid).get();
  if (!agentDocSnap.exists) return { success: false, error: 'Agent not found' };
  const agentData = agentDocSnap.data();
  const callerWithPath = { ...caller, hierarchyPath: agentData.hierarchyPath || '' };

  // Run all 4 queries in parallel — single cold start
  const [carriersSnap, agentsSnap, stagesSnap, dealsSnap] = await Promise.all([
    db.collection('carriers').where('agencyId', '==', caller.agencyId).get(),
    db.collection('agents').where('agency_id', '==', caller.agencyId).get(),
    db.collection('pipelineStages').where('agencyId', '==', caller.agencyId).orderBy('order', 'asc').get(),
    db.collection('deals').where('agencyId', '==', caller.agencyId).get(),
  ]);

  const carriers = [];
  carriersSnap.forEach(doc => {
    const data = doc.data();
    carriers.push({ id: doc.id, name: data.name });
  });

  const agentMap = {};
  agentsSnap.forEach(doc => {
    const d = doc.data();
    agentMap[doc.id] = {
      full_name: getDisplayName(d),
      firstName: d.first_name || d.full_name?.split(' ')[0] || '',
      lastName: d.last_name || d.full_name?.split(' ').slice(1).join(' ') || '',
      photo_url: d.photo_url || '',
    };
  });

  const stages = [];
  stagesSnap.forEach(doc => {
    stages.push({ id: doc.id, name: doc.data().name });
  });

  const deals = [];
  dealsSnap.forEach(doc => {
    const data = doc.data();
    if (canSee({ ...data, id: doc.id }, callerWithPath)) {
      deals.push({ id: doc.id, ...sanitize(data) });
    }
  });

  return { success: true, carriers, agentMap, stages, deals };
}

/**
 * Fetch only the caller's own deals (no downline/team visibility).
 * Used by the personal pipeline board.
 */
export async function fetchMyDeals() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const snap = await db.collection('deals')
    .where('agencyId', '==', caller.agencyId)
    .where('ownerAgentId', '==', caller.uid)
    .get();

  const deals = [];
  snap.forEach(doc => {
    deals.push({ id: doc.id, ...sanitize(doc.data()) });
  });

  return { success: true, deals };
}

/**
 * Fetch agent documents (onboarding uploads) for the caller.
 */
export async function fetchAgentDocuments() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const snap = await db.collection('agentDocuments').where('agentId', '==', caller.uid).get();
  const docs = [];
  snap.forEach(doc => docs.push({ id: doc.id, ...sanitize(doc.data()) }));

  return { success: true, documents: docs };
}
