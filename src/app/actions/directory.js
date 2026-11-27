'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

// The only fields colleagues need about each other: who someone is and where they sit.
// Personal details (date of birth, address, phone, SSN digits, card and Stripe details) are never included.
const SAFE_FIELDS = ['first_name', 'middle_name', 'last_name', 'full_name', 'preferred_name', 'email', 'role', 'is_owner',
  'status', 'agentLevel', 'contractLevel', 'upline_id', 'hierarchyPath', 'photo_url', 'nxt_id', 'agency_id'];

/** Name-and-position list of everyone in the caller's agency. Use this instead of reading agent records in the browser. */
export async function fetchAgentDirectory() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const snap = await getAdminApp().firestore().collection('agents').where('agency_id', '==', caller.agencyId).get();
    const agents = snap.docs.map(d => {
      const x = d.data(); const out = { id: d.id };
      SAFE_FIELDS.forEach(k => { if (x[k] !== undefined) out[k] = x[k]; });
      return out;
    });
    return { success: true, agents };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
