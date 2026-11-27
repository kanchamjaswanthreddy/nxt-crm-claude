'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { getDisplayName } from '@/lib/constants';
import { requireUser } from '@/lib/serverAuth';

const PRIVILEGED_ROLES = ['admin', 'it_engineer'];
const MAX_BATCH_SIZE = 400;

/**
 * Check if the caller has admin/owner privileges.
 */
async function assertPrivileged(db, _callerUidFromClient) {
  // The caller is taken from the signed-in session. The id the browser passes in is ignored:
  // trusting it let anyone act as an owner just by sending the owner's id.
  let session;
  try { session = await requireUser(); } catch { return { ok: false, error: 'Unauthorized' }; }
  const callerUid = session.uid;
  const callerSnap = await db.collection('agents').doc(callerUid).get();
  if (!callerSnap.exists) return { ok: false, error: 'Caller agent not found.' };
  const data = callerSnap.data();
  if (!data.is_owner && !PRIVILEGED_ROLES.includes(data.role)) {
    return { ok: false, error: 'Only admins can manage hierarchy.' };
  }
  return { ok: true, caller: { id: callerUid, ...data } };
}

/**
 * Detect cycles: returns true if `targetId` is a descendant of `agentId`.
 */
function isDescendant(agentId, targetId, agentMap) {
  let current = targetId;
  const visited = new Set();
  while (current) {
    if (current === agentId) return true;
    if (visited.has(current)) return false; // broken chain, stop
    visited.add(current);
    current = agentMap[current]?.upline_id || null;
  }
  return false;
}

/**
 * Compute the new hierarchyPath for an agent given its new parent.
 */
function computePath(parentPath, agentId) {
  const base = parentPath || '';
  return `${base}/${agentId}`;
}

/**
 * Collect all descendants of `agentId` from a flat agent list.
 * Returns array of { id, oldPath } for agents whose hierarchyPath starts with oldPath + '/'.
 */
function collectDescendants(agentId, oldPath, allAgents) {
  const descendants = [];
  for (const agent of allAgents) {
    if (agent.id === agentId) continue;
    if (agent.hierarchyPath && agent.hierarchyPath.startsWith(oldPath + '/')) {
      descendants.push({ id: agent.id, oldPath: agent.hierarchyPath });
    }
  }
  return descendants;
}

/**
 * Preview what a move would change — no writes.
 * Returns the list of agents affected and their old/new paths.
 */
export async function previewMove(callerUid, agentId, newParentId) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const auth = await assertPrivileged(db, callerUid);
    if (!auth.ok) return { success: false, error: auth.error };

    const [agentSnap, parentSnap] = await Promise.all([
      db.collection('agents').doc(agentId).get(),
      newParentId ? db.collection('agents').doc(newParentId).get() : Promise.resolve(null),
    ]);

    if (!agentSnap.exists) return { success: false, error: 'Agent not found.' };
    if (newParentId && (!parentSnap || !parentSnap.exists)) {
      return { success: false, error: 'New parent agent not found.' };
    }

    const agentData = agentSnap.data();
    const agencyId = agentData.agency_id;

    // Cannot move to self
    if (agentId === newParentId) {
      return { success: false, error: 'Cannot assign agent under themselves.' };
    }

    // Load all agents in agency to detect cycles and find descendants
    const allSnap = await db.collection('agents').where('agency_id', '==', agencyId).get();
    const allAgents = [];
    const agentMap = {};
    allSnap.forEach(d => {
      const a = { id: d.id, ...d.data() };
      allAgents.push(a);
      agentMap[d.id] = a;
    });

    // Cycle detection
    if (newParentId && isDescendant(agentId, newParentId, agentMap)) {
      return { success: false, error: 'Cannot move agent under their own descendant (would create a cycle).' };
    }

    const oldPath = agentData.hierarchyPath || `/${agentId}`;
    const parentPath = newParentId ? (parentSnap.data().hierarchyPath || `/${newParentId}`) : '';
    const newPath = computePath(parentPath, agentId);
    const descendants = collectDescendants(agentId, oldPath, allAgents);

    const changes = [
      {
        id: agentId,
        name: getDisplayName(agentData) || agentData.email,
        oldUplineId: agentData.upline_id || null,
        newUplineId: newParentId || null,
        oldPath,
        newPath,
      },
    ];

    for (const desc of descendants) {
      const descAgent = agentMap[desc.id];
      const descNewPath = newPath + desc.oldPath.slice(oldPath.length);
      changes.push({
        id: desc.id,
        name: getDisplayName(descAgent) || descAgent?.email || desc.id,
        oldUplineId: descAgent?.upline_id || null,
        newUplineId: descAgent?.upline_id || null, // descendants keep their direct parent
        oldPath: desc.oldPath,
        newPath: descNewPath,
      });
    }

    return { success: true, changes, totalAffected: changes.length };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Move an agent under a new parent. Cascades hierarchyPath to all descendants.
 * Logs the move to `hierarchyMoves` for audit and undo.
 *
 * @param {string} callerUid - UID of the admin performing the move
 * @param {string} agentId - Agent being moved
 * @param {string|null} newParentId - New parent agent UID, or null to make top-level
 */
export async function moveAgent(callerUid, agentId, newParentId) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const auth = await assertPrivileged(db, callerUid);
    if (!auth.ok) return { success: false, error: auth.error };

    const [agentSnap, parentSnap] = await Promise.all([
      db.collection('agents').doc(agentId).get(),
      newParentId ? db.collection('agents').doc(newParentId).get() : Promise.resolve(null),
    ]);

    if (!agentSnap.exists) return { success: false, error: 'Agent not found.' };
    if (newParentId && (!parentSnap || !parentSnap.exists)) {
      return { success: false, error: 'New parent agent not found.' };
    }

    const agentData = agentSnap.data();
    const agencyId = agentData.agency_id;

    // Owner must never have an upline
    if (agentData.is_owner) {
      return { success: false, error: 'The agency owner cannot be assigned under another agent.' };
    }

    if (agentId === newParentId) {
      return { success: false, error: 'Cannot assign agent under themselves.' };
    }

    // No-op if already under this parent
    if ((agentData.upline_id || null) === (newParentId || null)) {
      return { success: true, noChange: true, message: 'Agent is already under this parent.' };
    }

    // Load all agents for cycle check + descendant cascade
    const allSnap = await db.collection('agents').where('agency_id', '==', agencyId).get();
    const allAgents = [];
    const agentMap = {};
    allSnap.forEach(d => {
      const a = { id: d.id, ...d.data() };
      allAgents.push(a);
      agentMap[d.id] = a;
    });

    // Cycle detection
    if (newParentId && isDescendant(agentId, newParentId, agentMap)) {
      return { success: false, error: 'Cannot move agent under their own descendant (would create a cycle).' };
    }

    const oldUplineId = agentData.upline_id || null;
    const oldPath = agentData.hierarchyPath || `/${agentId}`;
    const parentPath = newParentId ? (parentSnap.data().hierarchyPath || `/${newParentId}`) : '';
    const newPath = computePath(parentPath, agentId);

    // Collect descendants that need path rewrite
    const descendants = collectDescendants(agentId, oldPath, allAgents);

    // Build all writes
    const writes = [
      { id: agentId, data: { upline_id: newParentId || null, hierarchyPath: newPath } },
    ];
    for (const desc of descendants) {
      const descNewPath = newPath + desc.oldPath.slice(oldPath.length);
      writes.push({ id: desc.id, data: { hierarchyPath: descNewPath } });
    }

    // Execute in batched writes (Firestore limit = 500 per batch, we use 400 for safety)
    const chunks = [];
    for (let i = 0; i < writes.length; i += MAX_BATCH_SIZE) {
      chunks.push(writes.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      for (const w of chunk) {
        batch.update(db.collection('agents').doc(w.id), w.data);
      }
      await batch.commit();
    }

    // Audit log
    const moveLog = {
      agencyId,
      agentId,
      agentName: getDisplayName(agentData) || agentData.email || agentId,
      oldUplineId,
      newUplineId: newParentId || null,
      oldPath,
      newPath,
      descendantsUpdated: descendants.length,
      performedBy: auth.caller.id,
      performedByName: getDisplayName(auth.caller) || auth.caller.email || auth.caller.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      undone: false,
    };
    const moveRef = await db.collection('hierarchyMoves').add(moveLog);

    return {
      success: true,
      moveId: moveRef.id,
      agentId,
      newParentId: newParentId || null,
      descendantsUpdated: descendants.length,
    };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Undo a previous hierarchy move by reversing the path changes.
 */
export async function undoMove(callerUid, moveId) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const auth = await assertPrivileged(db, callerUid);
    if (!auth.ok) return { success: false, error: auth.error };

    const moveSnap = await db.collection('hierarchyMoves').doc(moveId).get();
    if (!moveSnap.exists) return { success: false, error: 'Move record not found.' };

    const move = moveSnap.data();
    if (move.undone) return { success: false, error: 'This move has already been undone.' };

    const agentSnap = await db.collection('agents').doc(move.agentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent no longer exists.' };

    const agentData = agentSnap.data();

    // Owner must never have an upline
    if (agentData.is_owner) {
      return { success: false, error: 'Cannot undo a move for the agency owner.' };
    }

    const currentPath = agentData.hierarchyPath || '';

    // Verify agent is still at the path we moved them to (no subsequent moves)
    if (currentPath !== move.newPath) {
      return {
        success: false,
        error: 'Agent has been moved again since this move. Cannot undo — hierarchy has changed.',
      };
    }

    // Load all agents for descendant cascade
    const allSnap = await db.collection('agents').where('agency_id', '==', move.agencyId).get();
    const allAgents = [];
    allSnap.forEach(d => allAgents.push({ id: d.id, ...d.data() }));

    const descendants = collectDescendants(move.agentId, move.newPath, allAgents);

    const writes = [
      { id: move.agentId, data: { upline_id: move.oldUplineId || null, hierarchyPath: move.oldPath } },
    ];
    for (const desc of descendants) {
      const restoredPath = move.oldPath + desc.oldPath.slice(move.newPath.length);
      writes.push({ id: desc.id, data: { hierarchyPath: restoredPath } });
    }

    const chunks = [];
    for (let i = 0; i < writes.length; i += MAX_BATCH_SIZE) {
      chunks.push(writes.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      for (const w of chunk) {
        batch.update(db.collection('agents').doc(w.id), w.data);
      }
      await batch.commit();
    }

    // Mark original move as undone
    await db.collection('hierarchyMoves').doc(moveId).update({
      undone: true,
      undoneAt: admin.firestore.FieldValue.serverTimestamp(),
      undoneBy: auth.caller.id,
    });

    return { success: true, agentId: move.agentId, restoredUplineId: move.oldUplineId };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Backfill hierarchyPath for ALL agents in the agency.
 * Rebuilds paths from scratch using upline_id relationships.
 * This fixes agents who signed up via invite flow (missing hierarchyPath)
 * and agents whose paths went stale after reassignment.
 *
 * @param {string} callerUid - UID of the admin running the backfill
 * @returns {{ success, fixed, skipped, orphans, total }}
 */
export async function backfillHierarchyPaths(callerUid) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const auth = await assertPrivileged(db, callerUid);
    if (!auth.ok) return { success: false, error: auth.error };

    const agencyId = auth.caller.agency_id;

    // 1. Fetch all agents in the agency
    const allSnap = await db.collection('agents').where('agency_id', '==', agencyId).get();
    const agentMap = {};
    const childrenMap = {};

    allSnap.forEach(d => {
      const data = d.data();
      agentMap[d.id] = { id: d.id, ...data };
      if (!childrenMap[d.id]) childrenMap[d.id] = [];
    });

    // 2. Build parent→children map from upline_id
    let ownerId = null;
    for (const id of Object.keys(agentMap)) {
      const agent = agentMap[id];
      if (agent.is_owner) ownerId = id;
      const parentId = agent.upline_id;
      if (parentId) {
        if (!childrenMap[parentId]) childrenMap[parentId] = [];
        childrenMap[parentId].push(id);
      }
    }

    if (!ownerId) {
      return { success: false, error: 'No agency owner found. Cannot build hierarchy.' };
    }

    // 3. BFS from owner to compute correct paths
    const correctPaths = {};
    const queue = [{ id: ownerId, path: `/${ownerId}` }];
    const visited = new Set();

    while (queue.length > 0) {
      const { id, path } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      correctPaths[id] = path;

      const children = childrenMap[id] || [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          queue.push({ id: childId, path: `${path}/${childId}` });
        }
      }
    }

    // 4. Find orphans — agents with upline_id pointing to non-existent agent or not reachable from owner
    const orphans = [];
    for (const id of Object.keys(agentMap)) {
      if (!visited.has(id)) {
        const agent = agentMap[id];
        orphans.push({
          id,
          name: getDisplayName(agent) || agent.email || id,
          upline_id: agent.upline_id || null,
        });
      }
    }

    // 5. For orphans with upline_id that exists in agentMap but wasn't reachable,
    //    try to resolve their path by walking up the upline chain
    for (const orphan of orphans) {
      if (orphan.upline_id && correctPaths[orphan.upline_id]) {
        const path = `${correctPaths[orphan.upline_id]}/${orphan.id}`;
        correctPaths[orphan.id] = path;
        visited.add(orphan.id);
        // Also process this orphan's children
        const oQueue = [{ id: orphan.id, path }];
        while (oQueue.length > 0) {
          const { id: oId, path: oPath } = oQueue.shift();
          const oChildren = childrenMap[oId] || [];
          for (const cId of oChildren) {
            if (!visited.has(cId)) {
              const cPath = `${oPath}/${cId}`;
              correctPaths[cId] = cPath;
              visited.add(cId);
              oQueue.push({ id: cId, path: cPath });
            }
          }
        }
      }
    }

    // Recalculate remaining orphans
    const remainingOrphans = Object.keys(agentMap).filter(id => !visited.has(id)).map(id => {
      const agent = agentMap[id];
      return { id, name: getDisplayName(agent) || agent.email || id, upline_id: agent.upline_id || null };
    });

    // 6. Batch write all agents whose hierarchyPath is missing or different
    const writes = [];
    let skipped = 0;

    for (const [id, correctPath] of Object.entries(correctPaths)) {
      const agent = agentMap[id];
      if (agent.hierarchyPath === correctPath) {
        skipped++;
        continue;
      }
      writes.push({ id, data: { hierarchyPath: correctPath } });
    }

    // Execute in batched writes
    for (let i = 0; i < writes.length; i += MAX_BATCH_SIZE) {
      const chunk = writes.slice(i, i + MAX_BATCH_SIZE);
      const batch = db.batch();
      for (const w of chunk) {
        batch.update(db.collection('agents').doc(w.id), w.data);
      }
      await batch.commit();
    }

    return {
      success: true,
      total: Object.keys(agentMap).length,
      fixed: writes.length,
      skipped,
      orphans: remainingOrphans,
    };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Diagnose hierarchy visibility for a specific agent.
 * Returns the agent's path and all agents who should be in their downline.
 */
export async function diagnoseAgentVisibility(callerUid, targetEmail) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const auth = await assertPrivileged(db, callerUid);
    if (!auth.ok) return { success: false, error: auth.error };

    const agencyId = auth.caller.agency_id;
    const allSnap = await db.collection('agents').where('agency_id', '==', agencyId).get();

    let target = null;
    const allAgents = [];
    allSnap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      allAgents.push(data);
      if (data.email === targetEmail) target = data;
    });

    if (!target) return { success: false, error: `Agent with email ${targetEmail} not found.` };

    const myPath = target.hierarchyPath || `/${target.id}`;

    // Find who they SHOULD see via hierarchyPath prefix
    const visibleByPath = allAgents.filter(a =>
      a.id === target.id || (a.hierarchyPath && a.hierarchyPath.startsWith(myPath + '/'))
    );

    // Find who has upline_id pointing to them (direct reports)
    const directReports = allAgents.filter(a => a.upline_id === target.id);

    // Find all descendants via upline_id chain (BFS)
    const descendantsByUpline = [];
    const queue = [target.id];
    const visited = new Set([target.id]);
    while (queue.length > 0) {
      const parentId = queue.shift();
      for (const a of allAgents) {
        if (a.upline_id === parentId && !visited.has(a.id)) {
          visited.add(a.id);
          descendantsByUpline.push(a);
          queue.push(a.id);
        }
      }
    }

    // Find mismatches — agents in upline tree but NOT in hierarchyPath visibility
    const visibleIds = new Set(visibleByPath.map(a => a.id));
    const missingFromPath = descendantsByUpline.filter(a => !visibleIds.has(a.id));

    return {
      success: true,
      agent: { id: target.id, name: getDisplayName(target), email: target.email, hierarchyPath: myPath, upline_id: target.upline_id },
      visibleByPath: visibleByPath.map(a => ({ id: a.id, name: getDisplayName(a), email: a.email, hierarchyPath: a.hierarchyPath })),
      directReports: directReports.map(a => ({ id: a.id, name: getDisplayName(a), email: a.email, hierarchyPath: a.hierarchyPath, upline_id: a.upline_id })),
      descendantsByUpline: descendantsByUpline.map(a => ({ id: a.id, name: getDisplayName(a), email: a.email, hierarchyPath: a.hierarchyPath, upline_id: a.upline_id })),
      missingFromPath: missingFromPath.map(a => ({ id: a.id, name: getDisplayName(a), email: a.email, hierarchyPath: a.hierarchyPath, upline_id: a.upline_id })),
    };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Fetch recent hierarchy moves for the agency (for the audit log UI).
 */
export async function fetchHierarchyMoves(callerUid, limit = 50) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const auth = await assertPrivileged(db, callerUid);
    if (!auth.ok) return { success: false, error: auth.error };

    const agencyId = auth.caller.agency_id;
    const snap = await db.collection('hierarchyMoves')
      .where('agencyId', '==', agencyId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const moves = [];
    snap.forEach(d => {
      const data = d.data();
      moves.push({
        id: d.id,
        agentId: data.agentId,
        agentName: data.agentName,
        oldUplineId: data.oldUplineId,
        newUplineId: data.newUplineId,
        descendantsUpdated: data.descendantsUpdated,
        performedByName: data.performedByName,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        undone: data.undone || false,
      });
    });

    return { success: true, moves };
  } catch (error) {

    return { success: false, error: error.message };
  }
}
