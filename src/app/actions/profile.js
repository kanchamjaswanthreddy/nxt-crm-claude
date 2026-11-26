'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin, requireApprover, isInSubtree } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, validatePhone, FIELD_LIMITS } from '@/lib/validation';

const PROFILE_UPDATE_ALLOWLIST = new Set([
  'first_name', 'middle_name', 'last_name', 'preferred_name', 'phone', 'date_of_birth', 'address',
  'city', 'state', 'zip', 'npn', 'resident_state', 'email', 'photo_url',
  'onboarding_draft', 'onboarding_draft_saved_at',
]);

const ONBOARDING_ALLOWLIST = new Set([
  'first_name', 'middle_name', 'last_name', 'preferred_name', 'phone', 'date_of_birth', 'address',
  'city', 'state', 'zip', 'npn', 'resident_state', 'email', 'agreement',
  'status', 'onboarding_completed_at', 'stripe_customer_id',
  'stripe_subscription_id', 'payment',
]);

function cleanDoc(data) {
  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val.toDate === 'function') {
      clean[key] = val.toDate().toISOString();
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export async function fetchTeamData({ limit: agentLimit = 100, startAfter: startAfterId } = {}) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const agencyId = caller.agencyId;
  if (!agencyId) return { success: false, error: 'No agency ID' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // M-26: Cursor-based pagination for agents
    let agentQuery = db.collection('agents').where('agency_id', '==', agencyId).limit(agentLimit);
    if (startAfterId) {
      const cursorDoc = await db.collection('agents').doc(startAfterId).get();
      if (cursorDoc.exists) {
        agentQuery = agentQuery.startAfter(cursorDoc);
      }
    }

    const [agentSnap, inviteSnap] = await Promise.all([
      agentQuery.get(),
      db.collection('invites').where('agency_id', '==', agencyId).get(),
    ]);

    const agents = [];
    agentSnap.forEach(doc => agents.push({ id: doc.id, ...cleanDoc(doc.data()) }));

    const invites = [];
    inviteSnap.forEach(doc => invites.push({ id: doc.id, ...cleanDoc(doc.data()) }));

    // Auto-reconcile: link invites to agents by email match, backfill uid/signup_email
    const agentEmails = new Set(agents.map(a => a.email).filter(Boolean));
    const agentByEmail = {};
    for (const a of agents) {
      if (a.email) agentByEmail[a.email] = a;
    }
    const reconcilePromises = [];
    for (const invite of invites) {
      const matchedAgent = agentByEmail[invite.email];
      if (invite.status === 'pending' && matchedAgent) {
        // Mark pending invite as accepted
        invite.status = 'accepted';
        invite.accepted_at = new Date().toISOString();
        invite.accepted_by_uid = matchedAgent.id;
        invite.signup_email = matchedAgent.email;
        reconcilePromises.push(
          db.collection('invites').doc(invite.id).update({
            status: 'accepted',
            accepted_at: invite.accepted_at,
            accepted_by_uid: matchedAgent.id,
            signup_email: matchedAgent.email,
          })
        );
      } else if (invite.status === 'accepted' && !invite.accepted_by_uid && matchedAgent) {
        // Backfill uid/signup_email for existing accepted invites
        invite.accepted_by_uid = matchedAgent.id;
        invite.signup_email = matchedAgent.email;
        reconcilePromises.push(
          db.collection('invites').doc(invite.id).update({
            accepted_by_uid: matchedAgent.id,
            signup_email: matchedAgent.email,
          })
        );
      }
    }
    if (reconcilePromises.length > 0) {
      await Promise.all(reconcilePromises).catch(() => {
        // invite reconciliation failed silently
      });
    }

    // Auto-fix: find accepted invites whose agents are missing from the roster (agency_id not set on agent doc)
    const inviteEmails = invites
      .filter(i => i.status === 'accepted')
      .map(i => i.email)
      .filter(Boolean);
    const missingEmails = inviteEmails.filter(e => !agentEmails.has(e));
    if (missingEmails.length > 0) {
      const fixPromises = missingEmails.map(async (email) => {
        try {
          const orphanSnap = await db.collection('agents')
            .where('email', '==', email)
            .limit(1)
            .get();
          if (!orphanSnap.empty) {
            const orphanDoc = orphanSnap.docs[0];
            const orphanData = orphanDoc.data();
            if (!orphanData.agency_id || orphanData.agency_id !== agencyId) {
              await orphanDoc.ref.update({ agency_id: agencyId });
              agents.push({ id: orphanDoc.id, ...cleanDoc({ ...orphanData, agency_id: agencyId }) });
            }
          }
        } catch (_) {}
      });
      await Promise.all(fixPromises);
    }

    invites.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    // Metrics for current month
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const metricsSnap = await db.collection('AgentMetricsSummary')
      .where('agencyId', '==', agencyId)
      .where('period', '==', yearMonth)
      .get();

    const metrics = [];
    metricsSnap.forEach(doc => metrics.push({ id: doc.id, ...cleanDoc(doc.data()) }));

    return { success: true, agents, invites, metrics };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateMyProfile(updates) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!updates || typeof updates !== 'object') return { success: false, error: 'No updates provided' };

  // Validate user-provided text fields
  const lengthErr = validateLengths([
    [updates.first_name, 'First name', FIELD_LIMITS.name],
    [updates.middle_name, 'Middle name', FIELD_LIMITS.name],
    [updates.last_name, 'Last name', FIELD_LIMITS.name],
    [updates.preferred_name, 'Preferred name', FIELD_LIMITS.name],
    [updates.phone, 'Phone', FIELD_LIMITS.phone],
    [updates.address, 'Address', FIELD_LIMITS.address],
    [updates.city, 'City', FIELD_LIMITS.general],
    [updates.state, 'State', FIELD_LIMITS.state],
    [updates.zip, 'ZIP', FIELD_LIMITS.zip],
  ].filter(([v]) => v !== undefined));
  if (lengthErr) return { success: false, error: lengthErr };

  if (updates.phone) {
    const phoneErr = validatePhone(updates.phone);
    if (phoneErr) return { success: false, error: phoneErr };
  }

  // Apply field allowlist — strip any fields not in the allowed set
  const safeUpdates = {};
  for (const key of Object.keys(updates)) {
    if (PROFILE_UPDATE_ALLOWLIST.has(key)) {
      safeUpdates[key] = updates[key];
    }
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const docRef = db.collection('agents').doc(caller.uid);
    await docRef.set(safeUpdates, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function adminUpdateAgentProfile(agentId, updates) {
  let caller;
  try {
    caller = await requireAdmin();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!agentId) return { success: false, error: 'Missing parameters' };
  if (!updates || typeof updates !== 'object') return { success: false, error: 'No updates provided' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found.' };

    const agentData = agentSnap.data();
    if (agentData.agency_id !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    // Prevent overwriting protected fields
    const safeUpdates = { ...updates };
    delete safeUpdates.role;
    delete safeUpdates.is_owner;
    delete safeUpdates.agency_id;
    delete safeUpdates.uid;

    await db.collection('agents').doc(agentId).set(safeUpdates, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function uploadProfilePhoto(base64Data) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!base64Data || typeof base64Data !== 'string') return { success: false, error: 'No image data provided' };

  // base64Data is a data URL like "data:image/jpeg;base64,/9j/4AAQ..."
  const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);

  // L-09: Hard reject anything over 5MB
  if (sizeInBytes > 5 * 1024 * 1024) {
    return { success: false, error: 'Image too large. Maximum allowed size is 5MB.' };
  }

  // Firestore doc limit is 1MB — keep photo under 700KB to leave room for other fields
  if (sizeInBytes > 700 * 1024) {
    return { success: false, error: 'Image too large for profile storage. Please resize to under 700KB and try again.' };
  }

  try {
    const admin = getAdminApp();
    const db = admin.firestore();
    await db.collection('agents').doc(caller.uid).set({ photo_url: base64Data }, { merge: true });
    return { success: true, photo_url: base64Data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function completeOnboarding(agentData) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!agentData || typeof agentData !== 'object') return { success: false, error: 'No data provided' };

  // Server-side validation: all 3 agreements must be signed
  const agreement = agentData.agreement;
  if (!agreement) {
    return { success: false, error: 'Agreement signatures are required to complete onboarding.' };
  }
  const requiredDocs = ['ica', 'aoa', 'businessStandards'];
  for (const docKey of requiredDocs) {
    const sig = agreement[docKey];
    if (!sig || !sig.signatureName?.trim() || !sig.printName?.trim()) {
      return { success: false, error: `The ${docKey === 'ica' ? 'Independent Contractor Agreement' : docKey === 'aoa' ? 'Agent Ownership Agreement' : 'Business Standards'} must be signed.` };
    }
  }

  // Validate user-provided text fields
  const lengthErr = validateLengths([
    [agentData.first_name, 'First name', FIELD_LIMITS.name],
    [agentData.middle_name, 'Middle name', FIELD_LIMITS.name],
    [agentData.last_name, 'Last name', FIELD_LIMITS.name],
    [agentData.preferred_name, 'Preferred name', FIELD_LIMITS.name],
    [agentData.phone, 'Phone', FIELD_LIMITS.phone],
    [agentData.address, 'Address', FIELD_LIMITS.address],
    [agentData.city, 'City', FIELD_LIMITS.general],
    [agentData.state, 'State', FIELD_LIMITS.state],
    [agentData.zip, 'ZIP', FIELD_LIMITS.zip],
  ].filter(([v]) => v !== undefined));
  if (lengthErr) return { success: false, error: lengthErr };

  if (agentData.phone) {
    const phoneErr = validatePhone(agentData.phone);
    if (phoneErr) return { success: false, error: phoneErr };
  }

  // Apply field allowlist — strip role, is_owner, agency_id — those come from the invite lookup below
  const safeData = {};
  for (const key of Object.keys(agentData)) {
    if (ONBOARDING_ALLOWLIST.has(key)) {
      safeData[key] = agentData[key];
    }
  }
  // Strip protected identity fields regardless
  delete safeData.role;
  delete safeData.is_owner;
  delete safeData.agency_id;

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Look up agency_id, role, and upline from the invite by email
    const email = safeData.email || agentData.email;
    if (email) {
      const invSnap = await db.collection('invites')
        .where('email', '==', email)
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();
      if (!invSnap.empty) {
        const inv = invSnap.docs[0].data();
        safeData.agency_id = inv.agency_id;
        if (!safeData.role) safeData.role = inv.role;
        if (!safeData.upline_id && inv.upline_id && !safeData.is_owner) safeData.upline_id = inv.upline_id;
      }
    }

    const docRef = db.collection('agents').doc(caller.uid);
    await docRef.set(safeData, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function saveOnboardingDraft(draftData) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!draftData || typeof draftData !== 'object') return { success: false, error: 'No data provided' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.collection('agents').doc(caller.uid).set({
      onboarding_draft: draftData,
      onboarding_draft_saved_at: new Date().toISOString(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchPendingApprovals() {
  let caller;
  try {
    caller = await requireApprover();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const agencyId = caller.agencyId;
  if (!agencyId) return { success: false, error: 'No agency ID' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // M-05: Limit to avoid unbounded fetches (default 50)
    const snap = await db.collection('agents')
      .where('agency_id', '==', agencyId)
      .where('status', '==', 'pending_approval')
      .limit(50)
      .get();

    const agents = [];
    snap.forEach(doc => {
      const data = doc.data();

      // Team leaders only see agents in their subtree
      if (caller.isTeamLeaderOnly) {
        const path = data.hierarchyPath || '';
        if (!isInSubtree(path, caller.uid)) return;
      }

      const clean = {};
      for (const [key, val] of Object.entries(data)) {
        if (val && typeof val.toDate === 'function') {
          clean[key] = val.toDate().toISOString();
        } else {
          clean[key] = val;
        }
      }
      agents.push({ id: doc.id, ...clean });
    });

    agents.sort((a, b) => (b.onboarding_completed_at || '').localeCompare(a.onboarding_completed_at || ''));
    return { success: true, agents };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function approveAgent(agentId) {
  let caller;
  try {
    caller = await requireApprover();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!agentId) return { success: false, error: 'Missing parameters' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Get the agent and verify same agency
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found' };
    const agentData = agentSnap.data();

    if (agentData.agency_id !== caller.agencyId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Team leaders can only approve agents in their subtree
    if (caller.isTeamLeaderOnly) {
      const path = agentData.hierarchyPath || '';
      if (!isInSubtree(path, caller.uid)) {
        return { success: false, error: 'You can only approve agents in your team' };
      }
    }

    if (agentData.status !== 'pending_approval') {
      return { success: false, error: 'Agent is not pending approval' };
    }

    // Approve: set status to active
    await db.collection('agents').doc(agentId).update({
      status: 'active',
      approved_at: new Date().toISOString(),
      approved_by: caller.uid,
    });

    // Log activity
    const { logActivity } = await import('@/lib/activityLogger');
    logActivity({
      category: 'admin',
      action: 'approve_agent',
      actorId: caller.uid,
      actorName: caller.fullName,
      actorNxtId: caller.nxtId,
      targetId: agentId,
      targetName: getDisplayName(agentData),
      description: `Approved agent ${getDisplayName(agentData) || agentData.email}`,
    }).catch(() => {});

    // Send approval email
    try {
      const { sendApprovalEmail } = await import('@/lib/email/resend');
      await sendApprovalEmail({
        to: agentData.email,
        name: getDisplayName(agentData) || agentData.preferred_name || '',
      });
    } catch (_) {
      // approval email send failed silently
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function rejectAgent(agentId, reason) {
  let caller;
  try {
    caller = await requireApprover();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  if (!agentId) return { success: false, error: 'Missing parameters' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found' };

    const agentData = agentSnap.data();

    if (agentData.agency_id !== caller.agencyId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Team leaders can only reject agents in their subtree
    if (caller.isTeamLeaderOnly) {
      const path = agentData.hierarchyPath || '';
      if (!isInSubtree(path, caller.uid)) {
        return { success: false, error: 'You can only reject agents in your team' };
      }
    }

    await db.collection('agents').doc(agentId).update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: caller.uid,
      rejection_reason: reason || 'Application not approved.',
    });

    // Log activity
    const { logActivity } = await import('@/lib/activityLogger');
    logActivity({
      category: 'admin',
      action: 'reject_agent',
      actorId: caller.uid,
      actorName: caller.fullName,
      actorNxtId: caller.nxtId,
      targetId: agentId,
      targetName: getDisplayName(agentData),
      description: `Rejected agent ${getDisplayName(agentData) || agentData.email}${reason ? ': ' + reason : ''}`,
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function notifyAdminsOfCompletion(agentId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  // Only allow agents to notify about themselves
  if (agentId && agentId !== caller.uid) {
    return { success: false, error: 'Unauthorized' };
  }
  const targetAgentId = caller.uid;

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentSnap = await db.collection('agents').doc(targetAgentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found' };
    const agentData = agentSnap.data();

    // Find all admins and IT engineers in the same agency
    const adminSnap = await db.collection('agents')
      .where('agency_id', '==', agentData.agency_id)
      .get();

    const adminEmails = [];
    adminSnap.forEach(doc => {
      const d = doc.data();
      if ((d.role === 'admin' || d.role === 'it_engineer' || d.is_owner) && d.email && d.status === 'active') {
        adminEmails.push(d.email);
      }
    });

    if (adminEmails.length === 0) return { success: true, message: 'No admins to notify' };

    const { sendAdminNotificationEmail } = await import('@/lib/email/resend');
    await Promise.allSettled(
      adminEmails.map(email =>
        sendAdminNotificationEmail({
          to: email,
          agentName: getDisplayName(agentData) || agentData.email,
          agentEmail: agentData.email,
          agentRole: agentData.role || 'agent',
        })
      )
    );

    return { success: true, notified: adminEmails.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchMyProfile(uid) {
  // Special case: this function is used during the auth flow so it keeps the uid parameter.
  // We still verify the session caller matches the requested uid to prevent IDOR.
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const targetUid = uid || caller.uid;

  // Only allow fetching your own profile unless you're admin
  if (targetUid !== caller.uid && !caller.isOwner && caller.role !== 'admin' && caller.role !== 'it_engineer') {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const doc = await db.collection('agents').doc(targetUid).get();
    if (!doc.exists) {
      return { success: false, error: 'Profile not found' };
    }
    const data = doc.data();
    // Strip non-serializable fields (Timestamps → ISO strings)
    const clean = {};
    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val.toDate === 'function') {
        clean[key] = val.toDate().toISOString();
      } else {
        clean[key] = val;
      }
    }
    return { success: true, profile: clean };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function diagnoseUnlinkedInvites() {
  let caller;
  try {
    caller = await requireAdmin();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const agencyId = caller.agencyId;
  if (!agencyId) return { success: false, error: 'No agency ID' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const [agentSnap, inviteSnap] = await Promise.all([
      db.collection('agents').where('agency_id', '==', agencyId).get(),
      db.collection('invites').where('agency_id', '==', agencyId).get(),
    ]);

    const agents = [];
    agentSnap.forEach(doc => agents.push({ id: doc.id, email: doc.data().email, name: getDisplayName(doc.data()) }));

    const agentEmails = new Set(agents.map(a => a.email).filter(Boolean));
    const agentIds = new Set(agents.map(a => a.id));

    const results = [];
    inviteSnap.forEach(doc => {
      const inv = doc.data();
      if (inv.status !== 'accepted') return;

      const matchByUid = inv.accepted_by_uid && agentIds.has(inv.accepted_by_uid);
      const matchByEmail = agentEmails.has(inv.email);
      const matchBySignupEmail = inv.signup_email && agentEmails.has(inv.signup_email);

      results.push({
        inviteEmail: inv.email,
        status: inv.status,
        hasAgent: matchByUid || matchByEmail || matchBySignupEmail,
        matchMethod: matchByUid ? 'uid' : matchByEmail ? 'email' : matchBySignupEmail ? 'signup_email' : 'none',
        acceptedByUid: inv.accepted_by_uid || null,
        signupEmail: inv.signup_email || null,
      });
    });

    return { success: true, results, totalAgents: agents.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
