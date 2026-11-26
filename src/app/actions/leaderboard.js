'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';

/**
 * Fetch recruitment leaderboard for an agency.
 * Counts how many agents each person has recruited (via upline_id).
 * Returns ranked list with recruiter info and their recruits.
 */
export async function fetchRecruitmentLeaderboard() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Fetch all agents in the agency
    const agentsSnap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const agentMap = {};
    const recruitCounts = {};

    agentsSnap.forEach(doc => {
      const d = doc.data();
      agentMap[doc.id] = {
        id: doc.id,
        name: getDisplayName(d) || d.preferred_name || d.email || 'Unknown',
        email: d.email || '',
        nxtId: d.nxt_id || null,
        photoUrl: d.photo_url || null,
        role: d.role || 'agent',
        isOwner: !!d.is_owner,
        status: d.status || 'unknown',
        joinedAt: d.created_at || d.onboarding_completed_at || null,
      };

      // Count recruits by upline_id
      const uplineId = d.upline_id;
      if (uplineId) {
        if (!recruitCounts[uplineId]) recruitCounts[uplineId] = [];
        recruitCounts[uplineId].push({
          id: doc.id,
          name: getDisplayName(d) || d.preferred_name || d.email || 'Unknown',
          status: d.status || 'unknown',
          joinedAt: d.created_at || d.onboarding_completed_at || null,
        });
      }
    });

    // Build leaderboard: exclude agency owner so agents see real competition
    const leaderboard = Object.entries(recruitCounts)
      .filter(([recruiterId]) => agentMap[recruiterId] && !agentMap[recruiterId].isOwner)
      .map(([recruiterId, recruits]) => ({
        ...agentMap[recruiterId],
        recruitCount: recruits.length,
        activeRecruits: recruits.filter(r => r.status === 'active').length,
        recruits: recruits
          .sort((a, b) => (b.joinedAt || '').localeCompare(a.joinedAt || ''))
          .slice(0, 10), // latest 10 for display
      }))
      .sort((a, b) => b.recruitCount - a.recruitCount);

    // Also compute this month's recruits for "This Month" highlight
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const monthlyLeaderboard = Object.entries(recruitCounts)
      .filter(([recruiterId]) => agentMap[recruiterId] && !agentMap[recruiterId].isOwner)
      .map(([recruiterId, recruits]) => {
        const thisMonthRecruits = recruits.filter(r => r.joinedAt && r.joinedAt >= monthStart);
        return {
          ...agentMap[recruiterId],
          recruitCount: thisMonthRecruits.length,
          recruits: thisMonthRecruits,
        };
      })
      .filter(r => r.recruitCount > 0)
      .sort((a, b) => b.recruitCount - a.recruitCount);

    return {
      success: true,
      leaderboard,
      monthlyLeaderboard,
      totalAgents: agentsSnap.size,
    };
  } catch (error) {

    return { success: false, error: error.message };
  }
}

/**
 * Lightweight version for the dashboard card — just top 5 recruiters.
 */
export async function fetchTopRecruiters() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentsSnap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const agentMap = {};
    const recruitCounts = {};

    agentsSnap.forEach(doc => {
      const d = doc.data();
      agentMap[doc.id] = {
        name: getDisplayName(d) || d.preferred_name || d.email || 'Unknown',
        photoUrl: d.photo_url || null,
        nxtId: d.nxt_id || null,
        isOwner: !!d.is_owner,
      };

      const uplineId = d.upline_id;
      if (uplineId) {
        recruitCounts[uplineId] = (recruitCounts[uplineId] || 0) + 1;
      }
    });

    const topRecruiters = Object.entries(recruitCounts)
      .filter(([id]) => agentMap[id] && !agentMap[id].isOwner)
      .map(([id, count]) => ({
        id,
        name: agentMap[id].name,
        photoUrl: agentMap[id].photoUrl,
        nxtId: agentMap[id].nxtId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { success: true, topRecruiters };
  } catch (error) {

    return { success: false, error: error.message };
  }
}
