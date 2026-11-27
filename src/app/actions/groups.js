'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { GROUPS } from '@/lib/groups';
import { getDisplayName } from '@/lib/constants';

/**
 * Fetch all groups with their member counts.
 * Admin/IT only.
 */
export async function fetchGroups() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (caller.role !== 'admin' && caller.role !== 'it_engineer' && !caller.isOwner) {
    return { success: false, error: 'Permission denied' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const groups = [];

    for (const group of GROUPS) {
      const snap = await db.collection('group_members')
        .where('groupId', '==', group.id)
        .get();

      groups.push({
        ...group,
        memberCount: snap.size,
      });
    }

    return { success: true, groups };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Fetch members of a specific group.
 * Admin/IT only.
 */
export async function fetchGroupMembers(groupId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (caller.role !== 'admin' && caller.role !== 'it_engineer' && !caller.isOwner) {
    return { success: false, error: 'Permission denied' };
  }

  const group = GROUPS.find(g => g.id === groupId);
  if (!group) return { success: false, error: 'Group not found' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('group_members')
      .where('groupId', '==', groupId)
      .get();

    const members = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      // Fetch agent details
      const agentSnap = await db.collection('agents').doc(data.agentId).get();
      if (agentSnap.exists) {
        const agent = agentSnap.data();
        members.push({
          membershipId: doc.id,
          agentId: data.agentId,
          addedAt: data.addedAt?.toDate?.()?.toISOString() || null,
          name: getDisplayName(agent),
          email: agent.email || '',
          nxtId: agent.nxt_id || '',
          role: agent.role || 'agent',
          photo_url: agent.photo_url || null,
        });
      }
    }

    return { success: true, members, group };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Add an agent to a group.
 * Admin/IT only.
 */
export async function addGroupMember(groupId, agentId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (caller.role !== 'admin' && caller.role !== 'it_engineer' && !caller.isOwner) {
    return { success: false, error: 'Permission denied' };
  }

  const group = GROUPS.find(g => g.id === groupId);
  if (!group) return { success: false, error: 'Group not found' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Check if already a member
    const existing = await db.collection('group_members')
      .where('groupId', '==', groupId)
      .where('agentId', '==', agentId)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'Agent is already in this group' };
    }

    // Verify agent exists and is in same agency
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found' };
    if (agentSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not in your agency' };
    }

    await db.collection('group_members').add({
      groupId,
      agentId,
      addedBy: caller.uid,
      addedAt: new Date(),
    });

    // If this is the billing-exempt group, set the billingExempt flag on the agent
    if (group.billingExempt) {
      await db.collection('agents').doc(agentId).update({ billingExempt: true });
    }

    const agent = agentSnap.data();
    return {
      success: true,
      member: {
        agentId,
        name: getDisplayName(agent),
        email: agent.email || '',
        nxtId: agent.nxt_id || '',
        role: agent.role || 'agent',
        photo_url: agent.photo_url || null,
        addedAt: new Date().toISOString(),
      },
    };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Remove an agent from a group.
 * Admin/IT only.
 */
export async function removeGroupMember(groupId, agentId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (caller.role !== 'admin' && caller.role !== 'it_engineer' && !caller.isOwner) {
    return { success: false, error: 'Permission denied' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('group_members')
      .where('groupId', '==', groupId)
      .where('agentId', '==', agentId)
      .get();

    if (snap.empty) {
      return { success: false, error: 'Membership not found' };
    }

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // If this is the billing-exempt group, clear the billingExempt flag on the agent
    const group = GROUPS.find(g => g.id === groupId);
    if (group?.billingExempt) {
      await db.collection('agents').doc(agentId).update({ billingExempt: false });
    }

    return { success: true };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Search agents by name or NXT ID for adding to groups.
 * Admin/IT only.
 */
export async function searchAgentsForGroup(searchQuery) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (caller.role !== 'admin' && caller.role !== 'it_engineer' && !caller.isOwner) {
    return { success: false, error: 'Permission denied' };
  }

  if (!searchQuery || searchQuery.trim().length < 2) {
    return { success: true, agents: [] };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const q = searchQuery.trim().toLowerCase();
    const results = [];

    snap.forEach(doc => {
      const data = doc.data();
      const name = getDisplayName(data).toLowerCase();
      const nxtId = (data.nxt_id || '').toLowerCase();
      const email = (data.email || '').toLowerCase();

      if (name.includes(q) || nxtId.includes(q) || email.includes(q)) {
        results.push({
          id: doc.id,
          name: getDisplayName(data),
          email: data.email || '',
          nxtId: data.nxt_id || '',
          role: data.role || 'agent',
          photo_url: data.photo_url || null,
        });
      }
    });

    return { success: true, agents: results.slice(0, 10) };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Auto-seed the billing-exempt group with all agents currently exempt.
 * Adds owners, IT engineers, and agents with billingExempt: true who aren't already members.
 * Called once when the billing-exempt group detail page loads.
 */
export async function seedBillingExemptGroup() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (caller.role !== 'admin' && caller.role !== 'it_engineer' && !caller.isOwner) {
    return { success: false, error: 'Permission denied' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const GROUP_ID = 'billing-exempt';

  try {
    // Get current members of the group
    const memberSnap = await db.collection('group_members')
      .where('groupId', '==', GROUP_ID)
      .get();
    const existingIds = new Set(memberSnap.docs.map(d => d.data().agentId));

    // Get all agents in the agency who should be exempt
    const agentsSnap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const batch = db.batch();
    let added = 0;

    agentsSnap.forEach(doc => {
      const data = doc.data();
      const shouldBeExempt = data.is_owner || data.role === 'it_engineer' || data.billingExempt;
      if (shouldBeExempt && !existingIds.has(doc.id)) {
        const ref = db.collection('group_members').doc();
        batch.set(ref, {
          groupId: GROUP_ID,
          agentId: doc.id,
          addedBy: caller.uid,
          addedAt: new Date(),
        });
        added++;
      }
    });

    if (added > 0) {
      await batch.commit();
    }

    return { success: true, added };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Fetch the group IDs that the current user belongs to.
 * Used by the layout to conditionally show menu links.
 */
export async function fetchMyGroups() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('group_members')
      .where('agentId', '==', caller.uid)
      .get();

    const groupIds = snap.docs.map(doc => doc.data().groupId);
    return { success: true, groupIds };
  } catch (error) {

    return { success: false, error: error.message };
  }
}
