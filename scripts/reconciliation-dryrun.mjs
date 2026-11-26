/**
 * Dry-run of the metrics reconciliation.
 * Reads all source collections, computes expected metrics, compares to stored
 * AgentMetricsSummary docs, and prints the diff WITHOUT writing.
 *
 * Usage: node --env-file=.env.local scripts/reconciliation-dryrun.mjs
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function formatPem(key) {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formatPem(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

const db = getFirestore();

async function main() {
  const actuals = {};

  const initAgent = (agentId, agencyId, hierarchyPath) => {
    if (!actuals[agentId]) {
      actuals[agentId] = {
        agencyId,
        agentHierarchyPath: hierarchyPath,
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
    }
  };

  // Parallel reads
  const [commSnap, overSnap, dealSnap, leadSnap, taskSnap] = await Promise.all([
    db.collection('commissions').get(),
    db.collection('commissionOverrides').get(),
    db.collection('deals').get(),
    db.collection('leads').get(),
    db.collection('tasks').get(),
  ]);

  // 1. Commissions
  commSnap.forEach(doc => {
    const d = doc.data();
    if (!d.agentId || !d.commissionAmount) return;
    initAgent(d.agentId, d.agencyId, d.agentHierarchyPath);
    if (d.status === 'pending') actuals[d.agentId].commissionPending += d.commissionAmount;
    if (d.status === 'confirmed') actuals[d.agentId].commissionConfirmed += d.commissionAmount;
    if (d.status === 'paid') actuals[d.agentId].commissionPaid += d.commissionAmount;
  });

  // 2. Overrides
  overSnap.forEach(doc => {
    const d = doc.data();
    if (!d.beneficiaryAgentId || !d.overrideAmount) return;
    initAgent(d.beneficiaryAgentId, d.agencyId, d.beneficiaryHierarchyPath);
    if (d.status === 'pending') actuals[d.beneficiaryAgentId].overrideEarnedPending += d.overrideAmount;
    if (d.status === 'confirmed') actuals[d.beneficiaryAgentId].overrideEarnedConfirmed += d.overrideAmount;
    if (d.status === 'paid') actuals[d.beneficiaryAgentId].overrideEarnedPaid += d.overrideAmount;
  });

  // 3. Deals
  dealSnap.forEach(doc => {
    const d = doc.data();
    if (!d.ownerAgentId) return;
    initAgent(d.ownerAgentId, d.agencyId, d.ownerHierarchyPath);
    if (d.status === 'open') actuals[d.ownerAgentId].dealsOpenCount++;
    if (d.status === 'won') {
      actuals[d.ownerAgentId].dealsWonCount++;
      actuals[d.ownerAgentId].dealsWonPremiumTotal += (d.premiumAmount || 0);
    }
    if (d.status === 'lost') actuals[d.ownerAgentId].dealsLostCount++;
  });

  // 4. Leads
  leadSnap.forEach(doc => {
    const d = doc.data();
    if (!d.ownerAgentId) return;
    initAgent(d.ownerAgentId, d.agencyId, d.ownerHierarchyPath);
    actuals[d.ownerAgentId].leadsAssignedCount++;
    if (d.status === 'client') actuals[d.ownerAgentId].leadsConvertedCount++;
  });

  // 5. Tasks
  const now = Date.now();
  taskSnap.forEach(doc => {
    const d = doc.data();
    if (!d.ownerAgentId) return;
    initAgent(d.ownerAgentId, d.agencyId, d.ownerHierarchyPath);
    if (d.status === 'completed') actuals[d.ownerAgentId].tasksCompletedCount++;
    if (d.status === 'open' && d.dueAt && d.dueAt.toMillis() < now) {
      actuals[d.ownerAgentId].tasksOverdueCurrentCount++;
    }
  });

  // 6. Compare with stored
  let driftCount = 0;
  const numericKeys = Object.keys(actuals[Object.keys(actuals)[0]] || {}).filter(
    k => typeof (actuals[Object.keys(actuals)[0]]?.[k]) === 'number'
  );

  for (const [agentId, actual] of Object.entries(actuals)) {
    const allTimeId = `${agentId}_all_time`;
    const summarySnap = await db.collection('AgentMetricsSummary').doc(allTimeId).get();

    if (!summarySnap.exists) {
      driftCount++;
      console.log(`\n🆕 MISSING: ${agentId} (no AgentMetricsSummary doc)`);
      for (const key of numericKeys) {
        if (actual[key] !== 0) console.log(`   ${key}: 0 → ${actual[key]}`);
      }
      continue;
    }

    const stored = summarySnap.data();
    const diffs = {};
    let hasDrift = false;

    for (const key of numericKeys) {
      const storedVal = stored[key] || 0;
      const actualVal = actual[key] || 0;
      if (Math.abs(storedVal - actualVal) > 0.01) {
        hasDrift = true;
        diffs[key] = { stored: storedVal, actual: actualVal };
      }
    }

    if (hasDrift) {
      driftCount++;
      console.log(`\n⚠️  DRIFT: ${agentId}`);
      for (const [key, { stored: s, actual: a }] of Object.entries(diffs)) {
        console.log(`   ${key}: ${s} → ${a}`);
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Agents with data: ${Object.keys(actuals).length}`);
  console.log(`Collections read: commissions(${commSnap.size}), overrides(${overSnap.size}), deals(${dealSnap.size}), leads(${leadSnap.size}), tasks(${taskSnap.size})`);
  console.log(`Agents with drift: ${driftCount}`);
  if (driftCount === 0) {
    console.log(`✅ No drift detected — all metrics are in sync.`);
  } else {
    console.log(`\n⚠️  ${driftCount} agent(s) have drift. Run the actual reconciliation to fix.`);
  }
}

main().catch(err => {
  console.error('Dry-run failed:', err);
  process.exit(1);
});
