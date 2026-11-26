'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireAdmin } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

/**
 * Commission Override Server Actions
 *
 * Firestore collection: commissionOverrides
 * Doc structure:
 *   agentId       - the agent whose commissions are being split
 *   agentName     - display name of that agent
 *   beneficiaryId - the person earning the override
 *   beneficiaryName - display name of beneficiary
 *   percent       - override percentage (0.01 to 100)
 *   agencyId      - agency scope
 *   createdAt     - timestamp
 *   updatedAt     - timestamp
 *   createdBy     - uid of who set this up
 */

function validatePercent(p) {
  const num = parseFloat(p);
  if (isNaN(num) || num <= 0 || num > 100) return null;
  return Math.round(num * 100) / 100; // 2 decimal places
}

/** Get all overrides for a given agent (people earning from their sales) */
export async function getOverridesForAgent(agentId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!agentId) return { success: false, error: 'No agent ID' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify this agent belongs to the caller's agency
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists || agentSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }

    const snap = await db.collection('commissionOverrides')
      .where('agentId', '==', agentId)
      .get();

    const overrides = [];
    snap.forEach(doc => {
      const data = doc.data();
      overrides.push({
        id: doc.id,
        agentId: data.agentId,
        beneficiaryId: data.beneficiaryId,
        beneficiaryName: data.beneficiaryName || '',
        percent: data.percent,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return { success: true, overrides };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/** Get all overrides where a person is the beneficiary (earning from others) */
export async function getOverridesAsBeneficiary(beneficiaryId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!beneficiaryId) return { success: false, error: 'No beneficiary ID' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('commissionOverrides')
      .where('beneficiaryId', '==', beneficiaryId)
      .get();

    const overrides = [];
    snap.forEach(doc => {
      const data = doc.data();
      // Only return overrides that belong to the caller's agency
      if (data.agencyId !== caller.agencyId) return;
      overrides.push({
        id: doc.id,
        agentId: data.agentId,
        agentName: data.agentName || '',
        percent: data.percent,
      });
    });

    return { success: true, overrides };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/** Add or update an override. Validates total doesn't exceed 100%. */
export async function setOverride({ agentId, agentName, beneficiaryId, beneficiaryName, percent }) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const validPercent = validatePercent(percent);
  if (!validPercent) return { success: false, error: 'Percent must be between 0.01 and 100' };
  if (!agentId || !beneficiaryId) return { success: false, error: 'Agent and beneficiary required' };
  if (agentId === beneficiaryId) return { success: false, error: 'Agent cannot override themselves' };

  const nameErr = validateLengths([
    [agentName, 'Agent name', FIELD_LIMITS.name],
    [beneficiaryName, 'Beneficiary name', FIELD_LIMITS.name],
  ]);
  if (nameErr) return { success: false, error: nameErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify agent belongs to caller's agency
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists || agentSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }

    // Get existing overrides for this agent
    const snap = await db.collection('commissionOverrides')
      .where('agentId', '==', agentId)
      .get();

    let existingTotal = 0;
    let existingDocId = null;

    snap.forEach(doc => {
      const data = doc.data();
      if (data.beneficiaryId === beneficiaryId) {
        existingDocId = doc.id; // updating existing
      } else {
        existingTotal += data.percent;
      }
    });

    if (existingTotal + validPercent > 100) {
      return {
        success: false,
        error: `Total overrides would be ${existingTotal + validPercent}%. Maximum is 100%.`,
      };
    }

    const now = new Date();
    const overrideData = {
      agentId,
      agentName: agentName || '',
      beneficiaryId,
      beneficiaryName: beneficiaryName || '',
      percent: validPercent,
      agencyId: caller.agencyId,
      updatedAt: now,
      updatedBy: caller.uid,
    };

    if (existingDocId) {
      await db.collection('commissionOverrides').doc(existingDocId).update(overrideData);
    } else {
      await db.collection('commissionOverrides').add({
        ...overrideData,
        createdAt: now,
        createdBy: caller.uid,
      });
    }

    return { success: true };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/** Remove an override */
export async function removeOverride(overrideId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!overrideId) return { success: false, error: 'No override ID' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the override belongs to the caller's agency
    const overrideSnap = await db.collection('commissionOverrides').doc(overrideId).get();
    if (!overrideSnap.exists || overrideSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Override not found.' };
    }

    await db.collection('commissionOverrides').doc(overrideId).delete();
    return { success: true };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/** Bulk set overrides for an agent (used in invite flow). Replaces all existing. */
export async function setOverridesBulk({ agentId, agentName, overrides }) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!agentId) return { success: false, error: 'No agent ID' };
  if (!Array.isArray(overrides)) return { success: false, error: 'Overrides must be an array' };

  // Validate total
  let total = 0;
  for (const o of overrides) {
    const p = validatePercent(o.percent);
    if (!p) return { success: false, error: `Invalid percent: ${o.percent}` };
    if (o.beneficiaryId === agentId) return { success: false, error: 'Agent cannot override themselves' };
    total += p;
  }
  if (total > 100) return { success: false, error: `Total is ${total}%. Maximum is 100%.` };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify agent belongs to caller's agency
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists || agentSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }

    // Delete existing overrides for this agent
    const existing = await db.collection('commissionOverrides')
      .where('agentId', '==', agentId)
      .get();

    const batch = db.batch();
    existing.forEach(doc => batch.delete(doc.ref));

    // Add new overrides
    const now = new Date();
    for (const o of overrides) {
      const ref = db.collection('commissionOverrides').doc();
      batch.set(ref, {
        agentId,
        agentName: agentName || '',
        beneficiaryId: o.beneficiaryId,
        beneficiaryName: o.beneficiaryName || '',
        percent: validatePercent(o.percent),
        agencyId: caller.agencyId,
        createdAt: now,
        createdBy: caller.uid,
        updatedAt: now,
        updatedBy: caller.uid,
      });
    }

    await batch.commit();
    return { success: true };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/** Get all overrides for an agency (used for hierarchy split display) */
export async function getAllOverridesForAgency() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('commissionOverrides')
      .where('agencyId', '==', caller.agencyId)
      .get();

    const overrides = [];
    snap.forEach(doc => {
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

    return { success: true, overrides };
  } catch (error) {

    return { success: false, error: error.message };
  }
}
