'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

const nameOf = (d) => d?.preferred_name || [d?.first_name, d?.last_name].filter(Boolean).join(' ') || d?.full_name || d?.email || 'Unknown';

/**
 * Read-only estimate of what a deal would pay if it were won today.
 * - The agent's rate is looked up exactly as it is when a deal is marked won
 *   (commissionRates by carrier, policy type and the agent's level).
 * - The agent's commission is then divided by the manual split percentages set for that agent
 *   (Commission Distribution / hierarchy chart). Nothing is written.
 */
export async function previewDealCommission(dealId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!dealId) return { success: false, error: 'No deal' };

  const db = getAdminApp().firestore();
  try {
    const dealSnap = await db.collection('deals').doc(dealId).get();
    if (!dealSnap.exists) return { success: false, error: 'Deal not found' };
    const deal = dealSnap.data();
    if (deal.agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };
    const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner;
    if (deal.ownerAgentId !== caller.uid && !isAdmin) return { success: false, error: 'Unauthorized' };

    const agentSnap = await db.collection('agents').doc(deal.ownerAgentId).get();
    const agent = agentSnap.exists ? agentSnap.data() : {};
    const premium = Number(deal.premiumAmount) || 0;

    let ratePercent = null;
    if (agent.contractLevel && deal.carrierId && deal.policyType) {
      const todayIso = new Date().toISOString().split('T')[0];
      const rateSnap = await db.collection('commissionRates')
        .where('agencyId', '==', deal.agencyId)
        .where('carrierId', '==', deal.carrierId)
        .where('policyType', '==', deal.policyType)
        .where('agentLevel', '==', agent.contractLevel)
        .where('effectiveDate', '<=', todayIso)
        .orderBy('effectiveDate', 'desc')
        .limit(1)
        .get();
      if (!rateSnap.empty) ratePercent = Number(rateSnap.docs[0].data().commissionPercent) || 0;
    }
    const commissionAmount = ratePercent == null ? null : (premium * ratePercent) / 100;

    // Manual split rules for this agent (the documents that carry `percent` and `beneficiaryId`).
    const splitSnap = await db.collection('commissionOverrides').where('agentId', '==', deal.ownerAgentId).get();
    const splits = [];
    splitSnap.forEach(d => {
      const x = d.data();
      if (x.agencyId && x.agencyId !== deal.agencyId) return;
      const percent = Number(x.percent) || 0;
      if (!x.beneficiaryId || percent <= 0) return;
      splits.push({ id: d.id, name: x.beneficiaryName || 'Unknown', percent, amount: commissionAmount == null ? null : (commissionAmount * percent) / 100 });
    });
    splits.sort((a, b) => b.percent - a.percent);
    const splitTotal = Math.min(100, splits.reduce((t, s) => t + s.percent, 0));
    const keepPercent = Math.max(0, 100 - splitTotal);

    return {
      success: true,
      preview: {
        status: deal.status || 'open',
        premium,
        agentName: nameOf(agent),
        level: agent.contractLevel || null,
        ratePercent,
        commissionAmount,
        keepPercent,
        keepAmount: commissionAmount == null ? null : (commissionAmount * keepPercent) / 100,
        splits,
        missing: { level: !agent.contractLevel, carrier: !deal.carrierId, policyType: !deal.policyType, premium: !premium },
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
