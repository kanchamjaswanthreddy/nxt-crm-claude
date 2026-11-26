'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { verifyFirebaseIdToken } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';

/**
 * Verify Firebase ID token, look up agent in Firestore, return plain data object
 * with all fields needed for SAML assertion.
 *
 * Role mapping:
 *  - admin/owner -> application: 'bga', roles: 'officeManager'
 *  - agent       -> application: 'producer'
 */
export async function getSamlAgentData({ firebaseIdToken }) {
  if (!firebaseIdToken) {
    return { error: 'missing_token', error_description: 'Firebase ID token required' };
  }

  try {
    const decoded = await verifyFirebaseIdToken(firebaseIdToken);
    const uid = decoded.uid;

    const admin = getAdminApp();
    const db = admin.firestore();
    const agentDoc = await db.collection('agents').doc(uid).get();

    if (!agentDoc.exists) {
      return { error: 'access_denied', error_description: 'Agent profile not found' };
    }

    const agent = agentDoc.data();

    // Only allow active agents
    if (agent.status !== 'active') {
      return { error: 'access_denied', error_description: 'Agent account is not active' };
    }

    return {
      success: true,
      agent: {
        uid,
        email: agent.email || decoded.email || '',
        full_name: getDisplayName(agent) || decoded.name || '',
        phone: agent.phone || '',
        date_of_birth: agent.date_of_birth || '',
        npn: agent.npn || '',
        nxt_id: agent.nxt_id || '',
        role: agent.role || 'agent',
        is_owner: agent.is_owner || false,
      },
    };
  } catch (error) {
    return { error: 'server_error', error_description: 'SAML authorization failed' };
  }
}
