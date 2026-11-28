'use server';

export async function incrementAgentMetrics(transaction, admin, db, agencyId, agentId, agentHierarchyPath, updates) {
  if (!agentId || !updates || Object.keys(updates).length === 0) return;

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allTimeId = `${agentId}_all_time`;
  const monthId = `${agentId}_${yearMonth}`;

  const allTimeRef = db.collection('AgentMetricsSummary').doc(allTimeId);
  const monthRef = db.collection('AgentMetricsSummary').doc(monthId);

  // Convert pure number values to FieldValue.increment
  const firestoreUpdates = {};
  for (const [key, val] of Object.entries(updates)) {
    if (typeof val === 'number' && !isNaN(val)) {
      firestoreUpdates[key] = admin.firestore.FieldValue.increment(val);
    }
  }

  // Every counter must exist on the document (lists are sorted by them), but a counter that is not part of
  // this update must keep its value. increment(0) does both: it creates the field at 0 when it is missing and
  // leaves it untouched when it is there. (Writing a plain 0 here used to wipe the other counters on every call.)
  const zero = admin.firestore.FieldValue.increment(0);
  const createPayload = {
    agencyId,
    agentId,
    agentHierarchyPath,
    commissionPending: zero,
    commissionConfirmed: zero,
    commissionPaid: zero,
    overrideEarnedPending: zero,
    overrideEarnedConfirmed: zero,
    overrideEarnedPaid: zero,
    dealsWonCount: zero,
    dealsWonPremiumTotal: zero,
    dealsLostCount: zero,
    dealsOpenCount: zero,
    leadsAssignedCount: zero,
    leadsConvertedCount: zero,
    tasksCompletedCount: zero,
    tasksOverdueCurrentCount: zero,
  };

  const setOptions = { merge: true };
  const updatePayload = {
    ...firestoreUpdates,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // We use set with merge: true which creates if not exist, and applies increments if exists.
  transaction.set(allTimeRef, { ...createPayload, period: 'all_time', ...updatePayload }, setOptions);
  transaction.set(monthRef, { ...createPayload, period: yearMonth, ...updatePayload }, setOptions);
}
