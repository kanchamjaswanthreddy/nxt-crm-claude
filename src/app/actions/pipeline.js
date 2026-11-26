'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

const DEFAULT_STAGES = [
  { name: 'New', isWonStage: false, isLostStage: false },
  { name: 'Contacted', isWonStage: false, isLostStage: false },
  { name: 'Appointment Set', isWonStage: false, isLostStage: false },
  { name: 'Application Submitted', isWonStage: false, isLostStage: false },
  { name: 'Underwriting', isWonStage: false, isLostStage: false },
  { name: 'Closed Won', isWonStage: true, isLostStage: false },
  { name: 'Closed Lost', isWonStage: false, isLostStage: true }
];

/**
 * Seed personal pipeline stages for an agent.
 * If old agency-wide stages exist, copies those names so existing deals
 * can be remapped. Otherwise uses DEFAULT_STAGES.
 */
export async function seedDefaultStages() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const agencyId = caller.agencyId;
  const agentId = caller.uid;

  try {
    // Check if this agent already has personal stages
    const existingSnap = await db.collection('pipelineStages')
      .where('agentId', '==', agentId)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return { success: true, message: 'Stages already exist' };
    }

    // Check for old agency-wide stages to copy names from
    const oldSnap = await db.collection('pipelineStages')
      .where('agencyId', '==', agencyId)
      .orderBy('order', 'asc')
      .get();

    const oldStages = [];
    oldSnap.forEach(doc => {
      const d = doc.data();
      if (!d.agentId && !d.archived) {
        oldStages.push({ id: doc.id, ...d });
      }
    });

    // Use old agency stages if they exist, otherwise defaults
    const stagesToCreate = oldStages.length > 0
      ? oldStages.map(s => ({ name: s.name, isWonStage: !!s.isWonStage, isLostStage: !!s.isLostStage, order: s.order }))
      : DEFAULT_STAGES.map((s, i) => ({ ...s, order: i }));

    // Build a map: old stage name → old stage ID (for deal remapping)
    const oldNameToId = {};
    for (const s of oldStages) {
      oldNameToId[s.name] = s.id;
    }

    const batch = db.batch();
    const newNameToId = {};

    for (const stage of stagesToCreate) {
      const ref = db.collection('pipelineStages').doc();
      batch.set(ref, {
        agencyId,
        agentId,
        name: stage.name,
        order: stage.order,
        isWonStage: stage.isWonStage,
        isLostStage: stage.isLostStage,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      newNameToId[stage.name] = ref.id;
    }

    // Remap this agent's existing deals from old stage IDs to new personal stage IDs
    if (oldStages.length > 0) {
      const dealsSnap = await db.collection('deals')
        .where('agencyId', '==', agencyId)
        .where('ownerAgentId', '==', agentId)
        .get();

      // Build reverse map: old stage ID → stage name
      const oldIdToName = {};
      for (const s of oldStages) {
        oldIdToName[s.id] = s.name;
      }

      dealsSnap.forEach(doc => {
        const deal = doc.data();
        const oldStageName = oldIdToName[deal.stageId];
        if (oldStageName && newNameToId[oldStageName]) {
          batch.update(db.collection('deals').doc(doc.id), {
            stageId: newNameToId[oldStageName],
          });
        }
      });
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch pipeline stages for the caller (or a specific agent if admin).
 * Falls back to agency-wide stages if no personal stages exist (backward compat).
 */
export async function fetchPipelineStages(agentId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const agencyId = caller.agencyId;
  // If agentId is not passed, default to the caller's own stages
  const targetAgentId = agentId || caller.uid;

  try {
    // Try agent-specific stages first
    if (targetAgentId) {
      const agentSnap = await db.collection('pipelineStages')
        .where('agentId', '==', targetAgentId)
        .orderBy('order', 'asc')
        .get();

      if (!agentSnap.empty) {
        const stages = [];
        agentSnap.forEach(doc => {
          const d = doc.data();
          stages.push({
            id: doc.id,
            agencyId: d.agencyId,
            agentId: d.agentId,
            name: d.name,
            order: d.order,
            isWonStage: !!d.isWonStage,
            isLostStage: !!d.isLostStage,
            archived: !!d.archived,
          });
        });
        return { success: true, stages };
      }
    }

    // Fallback: agency-wide stages (old data / settings page)
    const snap = await db.collection('pipelineStages')
      .where('agencyId', '==', agencyId)
      .orderBy('order', 'asc')
      .get();

    const stages = [];
    snap.forEach(doc => {
      const d = doc.data();
      // Only return agency-wide stages (no agentId field)
      if (!d.agentId) {
        stages.push({
          id: doc.id,
          agencyId: d.agencyId,
          name: d.name,
          order: d.order,
          isWonStage: !!d.isWonStage,
          isLostStage: !!d.isLostStage,
          archived: !!d.archived,
        });
      }
    });

    return { success: true, stages };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createPipelineStage(name, order, agentId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const agencyId = caller.agencyId;
  const targetAgentId = agentId || caller.uid;

  const nameErr = validateLengths([[name, 'Stage name', FIELD_LIMITS.name]]);
  if (nameErr) return { success: false, error: nameErr };

  try {
    const ref = db.collection('pipelineStages').doc();
    const stageData = {
      agencyId,
      name,
      order,
      isWonStage: false,
      isLostStage: false,
      archived: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (targetAgentId) stageData.agentId = targetAgentId;
    await ref.set(stageData);
    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updatePipelineStage(stageId, data) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify stage belongs to caller's agency
    const stageDoc = await db.collection('pipelineStages').doc(stageId).get();
    if (!stageDoc.exists) return { success: false, error: 'Stage not found.' };
    if (stageDoc.data().agencyId !== caller.agencyId) return { success: false, error: 'Not authorized.' };

    await db.collection('pipelineStages').doc(stageId).update(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function archivePipelineStage(stageId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const agencyId = caller.agencyId;

  try {
    // Verify stage belongs to caller's agency
    const stageDoc = await db.collection('pipelineStages').doc(stageId).get();
    if (!stageDoc.exists) return { success: false, error: 'Stage not found.' };
    if (stageDoc.data().agencyId !== agencyId) return { success: false, error: 'Not authorized.' };

    // Cannot archive if deals are in it
    const dealsSnap = await db.collection('deals')
      .where('agencyId', '==', agencyId)
      .where('stageId', '==', stageId)
      .limit(1)
      .get();

    if (!dealsSnap.empty) {
      return { success: false, error: 'Cannot archive stage: there are deals still active in this stage. Please move them first.' };
    }

    await db.collection('pipelineStages').doc(stageId).update({
      archived: true // Soft delete
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
