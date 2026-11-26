import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebase/adminApp';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Verify Vercel Cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const admin = getAdminApp();
    const db = admin.firestore();

    const actuals = {}; // keyed by agentId
    
    // Helper to init agent bucket
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
          tasksOverdueCurrentCount: 0
        };
      }
    };

    // 1. Commissions
    const commSnap = await db.collection('commissions').get();
    commSnap.forEach(doc => {
      const data = doc.data();
      if (!data.agentId || !data.commissionAmount) return;
      initAgent(data.agentId, data.agencyId, data.agentHierarchyPath);
      if (data.status === 'pending') actuals[data.agentId].commissionPending += data.commissionAmount;
      if (data.status === 'confirmed') actuals[data.agentId].commissionConfirmed += data.commissionAmount;
      if (data.status === 'paid') actuals[data.agentId].commissionPaid += data.commissionAmount;
    });

    // 2. Overrides
    const overSnap = await db.collection('commissionOverrides').get();
    overSnap.forEach(doc => {
      const data = doc.data();
      if (!data.beneficiaryAgentId || !data.overrideAmount) return;
      initAgent(data.beneficiaryAgentId, data.agencyId, data.beneficiaryHierarchyPath);
      if (data.status === 'pending') actuals[data.beneficiaryAgentId].overrideEarnedPending += data.overrideAmount;
      if (data.status === 'confirmed') actuals[data.beneficiaryAgentId].overrideEarnedConfirmed += data.overrideAmount;
      if (data.status === 'paid') actuals[data.beneficiaryAgentId].overrideEarnedPaid += data.overrideAmount;
    });

    // 3. Deals
    const dealSnap = await db.collection('deals').get();
    dealSnap.forEach(doc => {
      const data = doc.data();
      if (!data.ownerAgentId) return;
      initAgent(data.ownerAgentId, data.agencyId, data.ownerHierarchyPath);
      if (data.status === 'open') actuals[data.ownerAgentId].dealsOpenCount++;
      if (data.status === 'won') {
        actuals[data.ownerAgentId].dealsWonCount++;
        actuals[data.ownerAgentId].dealsWonPremiumTotal += (data.premiumAmount || 0);
      }
      if (data.status === 'lost') actuals[data.ownerAgentId].dealsLostCount++;
    });

    // 4. Leads
    const leadSnap = await db.collection('leads').get();
    leadSnap.forEach(doc => {
      const data = doc.data();
      if (!data.ownerAgentId) return;
      initAgent(data.ownerAgentId, data.agencyId, data.ownerHierarchyPath);
      actuals[data.ownerAgentId].leadsAssignedCount++;
      if (data.status === 'client') actuals[data.ownerAgentId].leadsConvertedCount++;
    });

    // 5. Tasks
    const now = new Date().getTime();
    const taskSnap = await db.collection('tasks').get();
    taskSnap.forEach(doc => {
      const data = doc.data();
      if (!data.ownerAgentId) return;
      initAgent(data.ownerAgentId, data.agencyId, data.ownerHierarchyPath);
      if (data.status === 'completed') actuals[data.ownerAgentId].tasksCompletedCount++;
      
      // Calculate current overdue count as a snapshot (not an accumulated delta)
      if (data.status === 'open' && data.dueAt && data.dueAt.toMillis() < now) {
        actuals[data.ownerAgentId].tasksOverdueCurrentCount++;
      }
    });

    // 6. Reconciliation
    let driftCount = 0;
    const batch = db.batch();
    
    for (const [agentId, actual] of Object.entries(actuals)) {
      const allTimeId = `${agentId}_all_time`;
      const summaryRef = db.collection('AgentMetricsSummary').doc(allTimeId);
      
      const existingSnap = await summaryRef.get();
      let hasDrift = false;
      const drifts = {};

      if (existingSnap.exists) {
        const stored = existingSnap.data();
        for (const [key, val] of Object.entries(actual)) {
          // ignore agencyId and hierarchyPath for drift check, focus on numbers
          if (typeof val === 'number') {
            const storedVal = stored[key] || 0;
            if (Math.abs(storedVal - val) > 0.01) { // 0.01 tolerance for floating point
              hasDrift = true;
              drifts[key] = { stored: storedVal, actual: val };
            }
          }
        }
      } else {
        hasDrift = true;
        drifts['all'] = 'Document did not exist';
      }

      if (hasDrift) {
        driftCount++;
        console.warn(`[RECONCILIATION] Drift detected for agent ${agentId}:`, drifts);
        batch.set(summaryRef, {
          agentId,
          agencyId: actual.agencyId,
          agentHierarchyPath: actual.agentHierarchyPath,
          period: 'all_time',
          ...actual,
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    if (driftCount > 0) {
      await batch.commit();
      console.info(`[RECONCILIATION] Corrected drift for ${driftCount} agents.`);
    } else {
      console.info(`[RECONCILIATION] No drift detected.`);
    }

    return NextResponse.json({ success: true, driftCount, agentsProcessed: Object.keys(actuals).length });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
