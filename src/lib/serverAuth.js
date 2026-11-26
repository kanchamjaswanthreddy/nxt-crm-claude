import { getAdminApp, getServiceAccountAccessToken } from '@/lib/firebase/adminApp';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const SESSION_COOKIE_NAME = '__session';
export const SESSION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/**
 * Verify a raw Firebase ID token via the Identity Toolkit REST API.
 * This avoids importing firebase-admin/auth which conflicts with jose on Vercel.
 * Returns { uid, email, ... } or throws.
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing or invalid ID token');
  }

  const accessToken = await getServiceAccountAccessToken();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Token verification failed');
  }

  const data = await response.json();
  const user = data.users?.[0];
  if (!user) {
    throw new Error('Token verification failed: no user found');
  }

  return {
    uid: user.localId,
    email: user.email || '',
    name: user.displayName || '',
    email_verified: user.emailVerified || false,
  };
}

/**
 * Create a server-side session. Verifies the Firebase ID token,
 * generates a random session ID, stores it in Firestore, and returns
 * the session ID to be set as an httpOnly cookie.
 */
export async function createSession(idToken) {
  const verified = await verifyFirebaseIdToken(idToken);
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  const admin = getAdminApp();
  const db = admin.firestore();
  await db.collection('sessions').doc(sessionId).set({
    uid: verified.uid,
    email: verified.email,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return sessionId;
}

/**
 * Look up a session from Firestore by session ID.
 * Returns { uid, email } or null if invalid/expired.
 */
async function lookupSession(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') return null;

  try {
    const admin = getAdminApp();
    const db = admin.firestore();
    const doc = await db.collection('sessions').doc(sessionId).get();
    if (!doc.exists) return null;

    const session = doc.data();
    if (new Date(session.expiresAt) < new Date()) {
      // Expired — clean up
      doc.ref.delete().catch(() => {});
      return null;
    }

    return { uid: session.uid, email: session.email || '' };
  } catch {
    return null;
  }
}

/**
 * Delete a session from Firestore.
 */
export async function deleteSession(sessionId) {
  if (!sessionId) return;
  try {
    const admin = getAdminApp();
    const db = admin.firestore();
    await db.collection('sessions').doc(sessionId).delete();
  } catch {
    // Best effort
  }
}

/**
 * Load the agent document from Firestore by uid.
 */
async function loadAgentDoc(uid) {
  const admin = getAdminApp();
  const db = admin.firestore();
  const doc = await db.collection('agents').doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Build a standard caller object from session + agent doc.
 */
function buildCallerObject(session, agent) {
  return {
    uid: session.uid,
    email: agent.email || session.email || '',
    role: agent.role || 'agent',
    agencyId: agent.agency_id || '',
    nxtId: agent.nxt_id || '',
    isOwner: agent.is_owner === true,
    status: agent.status || '',
    firstName: agent.first_name || '',
    middleName: agent.middle_name || '',
    lastName: agent.last_name || '',
    fullName: [agent.first_name, agent.middle_name, agent.last_name].filter(Boolean).join(' ') || agent.full_name || '',
  };
}

/**
 * requireUser() — the core auth guard for server actions.
 *
 * Reads the httpOnly session cookie, looks up the session in Firestore,
 * loads the agent doc, and returns the caller's identity.
 *
 * Throws AUTH_REQUIRED if no valid session.
 * Throws AGENT_NOT_FOUND if agent doc doesn't exist.
 */
export async function requireUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await lookupSession(sessionId);
  if (!session) {
    throw new Error('AUTH_REQUIRED');
  }

  const agent = await loadAgentDoc(session.uid);
  if (!agent) {
    throw new Error('AGENT_NOT_FOUND');
  }

  return buildCallerObject(session, agent);
}

/**
 * requireAdmin() — like requireUser() but also checks admin/IT/owner role.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isOwner && user.role !== 'admin' && user.role !== 'it_engineer') {
    throw new Error('ADMIN_REQUIRED');
  }
  return user;
}

/**
 * requireOwner() — strictest check: only the agency owner.
 */
export async function requireOwner() {
  const user = await requireUser();
  if (!user.isOwner) {
    throw new Error('OWNER_REQUIRED');
  }
  return user;
}

/**
 * Check if a user is a team leader (member of the team-leaders group).
 */
export async function isTeamLeader(uid, agencyId) {
  const admin = getAdminApp();
  const db = admin.firestore();
  const snap = await db.collection('group_members')
    .where('groupId', '==', 'team-leaders')
    .where('agentId', '==', uid)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Check if targetAgent's hierarchyPath contains the leaderUid.
 * i.e., the target is somewhere in the leader's downline tree.
 */
export function isInSubtree(targetHierarchyPath, leaderUid) {
  if (!targetHierarchyPath || !leaderUid) return false;
  // hierarchyPath looks like /ownerUid/uplineUid/agentUid
  // If leaderUid appears anywhere before the target's own segment, they're an ancestor
  return targetHierarchyPath.includes(`/${leaderUid}/`);
}

/**
 * requireApprover() — allows admin/IT/owner OR team leaders.
 * Returns caller with an `isTeamLeaderOnly` flag if they are not a full admin.
 */
export async function requireApprover() {
  const user = await requireUser();

  // Full admins pass directly
  if (user.isOwner || user.role === 'admin' || user.role === 'it_engineer') {
    return { ...user, isTeamLeaderOnly: false };
  }

  // Check if user is a team leader
  const teamLeader = await isTeamLeader(user.uid, user.agencyId);
  if (teamLeader) {
    return { ...user, isTeamLeaderOnly: true };
  }

  throw new Error('ADMIN_REQUIRED');
}

/**
 * For API routes that receive the request object (not server actions).
 * Reads session cookie from the Cookie header.
 */
export async function requireUserFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  const sessionId = match ? match[1] : null;

  const session = await lookupSession(sessionId);
  if (!session) {
    throw new Error('AUTH_REQUIRED');
  }

  const agent = await loadAgentDoc(session.uid);
  if (!agent) {
    throw new Error('AGENT_NOT_FOUND');
  }

  return buildCallerObject(session, agent);
}

/**
 * For API routes, check admin from request object.
 */
export async function requireAdminFromRequest(request) {
  const user = await requireUserFromRequest(request);
  if (!user.isOwner && user.role !== 'admin' && user.role !== 'it_engineer') {
    throw new Error('ADMIN_REQUIRED');
  }
  return user;
}
