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

  // Common set payload for creating if missing
  const createPayload = {
    agencyId,
    agentId,
    agentHierarchyPath,
    commissionPending: 0,
    commissionConfirmed: 0,
    commissionPaid: 0,
    overrideEarnedPending: 0,
    overrideEarnedConfirmed: 0,
    overrideEarnedPaid: 0,
    dealsWonCount: 0,
    dealsWonPremiumTotal: 0,
    dealsLostCount: 0,
    dealsOpenCount: 0,
    leadsAssignedCount: 0,
    leadsConvertedCount: 0,
    tasksCompletedCount: 0,
    tasksOverdueCurrentCount: 0,
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
