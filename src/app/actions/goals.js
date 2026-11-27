'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

const isPrivileged = (u) => u.isOwner || u.role === 'admin' || u.role === 'it_engineer';
const clean = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 && n <= 1e9 ? n : null; };

/** Monthly production targets: the caller's own, and the agency's (shown to owners and admins). */
export async function fetchGoals() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  const db = getAdminApp().firestore();
  try {
    const [agentSnap, agencySnap] = await Promise.all([
      db.collection('agents').doc(caller.uid).get(),
      isPrivileged(caller) ? db.collection('agencyGoals').doc(caller.agencyId).get() : Promise.resolve(null),
    ]);
    return {
      success: true,
      myGoal: agentSnap.exists ? (agentSnap.data().monthlyGoal || null) : null,
      agencyGoal: agencySnap && agencySnap.exists ? (agencySnap.data().monthlyGoal || null) : null,
      canSetAgency: isPrivileged(caller),
    };
  } catch (error) { return { success: false, error: error.message }; }
}

/** scope: 'self' (anyone, their own target) or 'agency' (owners and admins). amount 0 or empty clears it. */
export async function saveGoal(scope, amount) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  const admin = getAdminApp(); const db = admin.firestore();
  const value = clean(amount);
  try {
    if (scope === 'agency') {
      if (!isPrivileged(caller)) return { success: false, error: 'Only owners and admins can set the agency goal.' };
      await db.collection('agencyGoals').doc(caller.agencyId).set({ agencyId: caller.agencyId, monthlyGoal: value, updatedBy: caller.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } else {
      await db.collection('agents').doc(caller.uid).update({ monthlyGoal: value });
    }
    return { success: true, goal: value };
  } catch (error) { return { success: false, error: error.message }; }
}
