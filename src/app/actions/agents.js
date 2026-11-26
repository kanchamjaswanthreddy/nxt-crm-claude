'use server';

import { getAdminApp, generateVerificationLinkREST } from '@/lib/firebase/adminApp';
import { sendVerificationEmail } from '@/lib/email/resend';
import { requireUser, requireAdmin, requireOwner, requireApprover, isInSubtree } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, validateEmail, validatePhone, FIELD_LIMITS } from '@/lib/validation';

/** Convert Firestore Timestamps to ISO strings so data crosses the Server→Client boundary safely. */
function sanitizeDoc(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v;
  }
  return out;
}

/**
 * Ensure the agency owner has no upline and has root hierarchyPath.
 * Returns { fixed, upline_id, hierarchyPath } for diagnostics.
 */
export async function fixOwnerUpline() {
  let caller;
  try { caller = await requireOwner(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .where('is_owner', '==', true)
      .limit(1)
      .get();

    if (snap.empty) return { success: false, error: 'No owner found.' };

    const ownerDoc = snap.docs[0];
    const data = ownerDoc.data();
    const ownerId = ownerDoc.id;
    const rootPath = `/${ownerId}`;

    const needsFix = data.upline_id || data.hierarchyPath !== rootPath;

    if (needsFix) {
      await db.collection('agents').doc(ownerId).update({
        upline_id: null,
        hierarchyPath: rootPath,
      });
    }

    return {
      success: true,
      fixed: needsFix,
      before: { upline_id: data.upline_id || null, hierarchyPath: data.hierarchyPath || null },
      after: { upline_id: null, hierarchyPath: rootPath },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchAgents() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents').where('agency_id', '==', caller.agencyId).get();
    let agents = [];
    snap.forEach(doc => {
      agents.push({ id: doc.id, ...sanitizeDoc(doc.data()) });
    });
    return { success: true, agents };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function cleanupOrphanAgents() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents').where('agency_id', '==', caller.agencyId).get();

    // Check all agents — orphans are agents with no email or status still "invited" with no activity
    const candidates = snap.docs.filter(d => d.id !== caller.uid);
    const orphanIds = candidates
      .filter(d => {
        const data = d.data();
        // Orphan: no email, or status is "invited" with no onboarding completed
        return !data.email || (data.status === 'invited' && !data.onboarding_completed_at);
      })
      .map(d => d.id);

    // Batch delete all orphans at once
    if (orphanIds.length > 0) {
      const batch = db.batch();
      orphanIds.forEach(id => batch.delete(db.collection('agents').doc(id)));
      await batch.commit();
    }

    return { success: true, removed: orphanIds.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function setOwnerFlag(agentId) {
  let caller;
  try { caller = await requireOwner(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents').doc(agentId).get();
    if (!snap.exists) {
      return { success: false, error: 'Agent not found.' };
    }

    // Verify agent belongs to caller's agency
    if (snap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }

    // Check no other owner exists in this agency
    const existing = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .where('is_owner', '==', true)
      .get();

    if (!existing.empty) {
      return { success: false, error: 'An owner already exists for this agency.' };
    }

    await db.collection('agents').doc(agentId).update({
      is_owner: true,
      role: 'admin',
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateAgentContractLevel(agentId, agentLevel) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const AGENT_LEVELS = [
    { level: 1, title: 'Unlicensed Associate', price: 10 },
    { level: 2, title: 'Financial Associate', price: 20 },
    { level: 3, title: 'Senior Financial Associate', price: 25 },
    { level: 4, title: 'Financial Director', price: 30 },
    { level: 5, title: 'Senior Financial Director', price: 40 },
  ];

  const levelInfo = AGENT_LEVELS.find(l => l.level === agentLevel);
  if (!levelInfo) return { success: false, error: 'Invalid agent level.' };

  try {
    // Verify agent belongs to caller's agency
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists || agentSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found.' };
    }

    await db.collection('agents').doc(agentId).update({
      agentLevel: levelInfo.level,
      contractLevel: levelInfo.title,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateAgentRole(agentId, newRole) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (agentId === caller.uid) {
    return { success: false, error: 'You cannot change your own role.' };
  }

  const validRoles = ['admin', 'agent', 'it_engineer'];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: 'Invalid role.' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const targetSnap = await db.collection('agents').doc(agentId).get();
    if (!targetSnap.exists) {
      return { success: false, error: 'Agent not found.' };
    }
    if (targetSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }
    if (targetSnap.data().is_owner) {
      return { success: false, error: 'Cannot change the owner role.' };
    }

    await db.collection('agents').doc(agentId).update({ role: newRole });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteAgent(agentId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  let admin, db;
  try {
    admin = getAdminApp();
    db = admin.firestore();
  } catch (initErr) {
    return { success: false, error: 'Server configuration error. Please contact support.' };
  }

  if (agentId === caller.uid) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  try {
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) {
      return { success: false, error: 'Agent not found.' };
    }

    const agentData = agentSnap.data();
    if (agentData.agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }
    if (agentData.is_owner) {
      return { success: false, error: 'The agency owner account cannot be deleted.' };
    }

    // Step 1: Delete agent Firestore doc (critical)
    await db.collection('agents').doc(agentId).delete();

    // Step 2: Delete Firebase Auth user via REST API (avoids admin.auth() ESM conflict)
    try {
      const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (firebaseApiKey) {
        // Use Admin SDK service account to get custom token, then delete via REST
        // For now, skip auth user deletion — orphan cleanup handles re-invites
      }
    } catch (authErr) {
      // Auth user deletion skipped — orphan cleanup handles re-invites
    }

    // Step 3: Reset any invites for this email so they can be re-invited
    try {
      const email = agentData.email;
      if (email) {
        const inviteSnap = await db.collection('invites')
          .where('email', '==', email)
          .where('agency_id', '==', caller.agencyId)
          .get();
        if (!inviteSnap.empty) {
          const batch = db.batch();
          inviteSnap.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (_) {}

    // Step 4: Delete agent documents (non-critical)
    try {
      const docsSnap = await db.collection('agentDocuments').where('agentId', '==', agentId).get();
      if (!docsSnap.empty) {
        const batch = db.batch();
        docsSnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (_) {}

    // Step 5: Audit log (non-critical)
    try {
      await db.collection('AuditLog').add({
        agencyId: caller.agencyId,
        actorAgentId: caller.uid,
        action: 'DELETE_AGENT',
        targetType: 'Agent',
        targetId: agentId,
        details: { agentName: getDisplayName(agentData) || agentData.email },
        timestamp: new Date().toISOString(),
      });
    } catch (_) {}

    return { success: true };
  } catch (error) {
    const msg = typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : 'Failed to delete agent.';
    return { success: false, error: msg };
  }
}

export async function approveDocument(docId) {
  let caller;
  try { caller = await requireApprover(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const docSnap = await db.collection('agentDocuments').doc(docId).get();
    if (!docSnap.exists) return { success: false, error: 'Document not found.' };

    const docData = docSnap.data();

    // Team leaders can only approve documents for agents in their subtree
    if (caller.isTeamLeaderOnly) {
      const agentSnap = await db.collection('agents').doc(docData.agentId).get();
      if (!agentSnap.exists || !isInSubtree(agentSnap.data().hierarchyPath, caller.uid)) {
        return { success: false, error: 'You can only approve documents for agents in your team.' };
      }
    }

    await db.collection('agentDocuments').doc(docId).update({
      status: 'approved',
      reviewedBy: caller.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    const { logActivity } = await import('@/lib/activityLogger');
    logActivity({
      category: 'documents',
      action: 'approve_document',
      actorId: caller.uid,
      actorName: caller.fullName,
      actorNxtId: caller.nxtId,
      targetId: docData.agentId,
      description: `Approved ${docData.docType} document`,
      metadata: { docId, docType: docData.docType },
    }).catch(() => {});

    // Check if all docs for this agent are now approved
    const agentId = docData.agentId;
    await updateAgentDocStatus(db, admin, agentId);

    // Send approval email to agent
    try {
      const agentSnap = await db.collection('agents').doc(agentId).get();
      if (agentSnap.exists) {
        const agentData = agentSnap.data();
        const { getDocTypeLabel } = await import('@/lib/documentTypes');
        const { sendDocumentApprovedEmail } = await import('@/lib/email/resend');
        await sendDocumentApprovedEmail({
          to: agentData.email,
          name: getDisplayName(agentData) || agentData.preferred_name,
          docTypeLabel: getDocTypeLabel(docData.docType),
        });
      }
    } catch (emailErr) {
      // email send failed silently
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function rejectDocument(docId, reason) {
  let caller;
  try { caller = await requireApprover(); } catch { return { success: false, error: 'Unauthorized' }; }

  const reasonErr = validateLengths([[reason, 'Reason', FIELD_LIMITS.note]]);
  if (reasonErr) return { success: false, error: reasonErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const docSnap = await db.collection('agentDocuments').doc(docId).get();
    if (!docSnap.exists) return { success: false, error: 'Document not found.' };
    const docData = docSnap.data();

    // Team leaders can only reject documents for agents in their subtree
    if (caller.isTeamLeaderOnly) {
      const agentSnap = await db.collection('agents').doc(docData.agentId).get();
      if (!agentSnap.exists || !isInSubtree(agentSnap.data().hierarchyPath, caller.uid)) {
        return { success: false, error: 'You can only reject documents for agents in your team.' };
      }
    }

    await db.collection('agentDocuments').doc(docId).update({
      status: 'rejected',
      rejectionReason: reason || 'Document did not meet requirements.',
      reviewedBy: caller.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    const { logActivity } = await import('@/lib/activityLogger');
    logActivity({
      category: 'documents',
      action: 'reject_document',
      actorId: caller.uid,
      actorName: caller.fullName,
      actorNxtId: caller.nxtId,
      targetId: docData.agentId,
      description: `Rejected ${docData.docType} document${reason ? ': ' + reason : ''}`,
      metadata: { docId, docType: docData.docType },
    }).catch(() => {});

    // Send rejection email to agent with reason
    try {
      const agentSnap = await db.collection('agents').doc(docData.agentId).get();
      if (agentSnap.exists) {
        const agentData = agentSnap.data();
        const { getDocTypeLabel } = await import('@/lib/documentTypes');
        const { sendDocumentRejectedEmail } = await import('@/lib/email/resend');
        await sendDocumentRejectedEmail({
          to: agentData.email,
          name: getDisplayName(agentData) || agentData.preferred_name,
          docTypeLabel: getDocTypeLabel(docData.docType),
          reason: reason || 'Document did not meet requirements.',
        });
      }
    } catch (emailErr) {
      // email send failed silently
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateAgentDocStatus(db, admin, agentId) {
  const allDocs = await db.collection('agentDocuments').where('agentId', '==', agentId).get();
  if (allDocs.empty) return;

  let uploaded = 0;
  let approved = 0;
  allDocs.forEach(d => {
    uploaded++;
    if (d.data().status === 'approved') approved++;
  });

  const allApproved = uploaded >= 5 && approved === uploaded;

  if (allApproved) {
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (agentSnap.exists) {
      const agentData = agentSnap.data();
      const hasLicense = agentData.npn && agentData.licensedStates?.length > 0;
      await db.collection('agents').doc(agentId).update({
        'onboardingProgress.documentsUploaded': true,
        'onboardingProgress.documentsApproved': true,
        status: hasLicense ? 'active' : 'pending_licensing',
      });
    }
  } else {
    await db.collection('agents').doc(agentId).update({
      'onboardingProgress.documentsUploaded': uploaded > 0,
      'onboardingProgress.documentsApproved': false,
    });
  }
}

export async function assignAgentToManager(agentId, managerId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const [agentSnap, managerSnap] = await Promise.all([
      db.collection('agents').doc(agentId).get(),
      managerId ? db.collection('agents').doc(managerId).get() : Promise.resolve(null),
    ]);

    if (!agentSnap.exists) return { success: false, error: 'Agent not found.' };
    if (agentSnap.data().agency_id !== caller.agencyId) return { success: false, error: 'Agent not in your agency.' };
    if (managerId && (!managerSnap || !managerSnap.exists)) return { success: false, error: 'Manager not found.' };

    // Owner must never have an upline
    if (agentSnap.data().is_owner) {
      return { success: false, error: 'The agency owner cannot be assigned under another agent.' };
    }

    const updateData = { upline_id: managerId || null };

    if (managerId && managerSnap.exists) {
      const managerData = managerSnap.data();
      updateData.hierarchyPath = (managerData.hierarchyPath || `/${managerId}`) + `/${agentId}`;
    }

    await db.collection('agents').doc(agentId).update(updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getTeamForManager(managerId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .where('upline_id', '==', managerId)
      .get();

    const agents = [];
    snap.forEach(d => agents.push({ id: d.id, ...sanitizeDoc(d.data()) }));
    return { success: true, agents };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search agents by name or NXT ID for the recruiter lookup on onboarding.
 * Returns up to 10 matches with { uid, fullName, nxtId }.
 */
export async function searchAgentsByNameOrNxtId(query) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: true, results: [] }; }

  if (!query || query.trim().length < 2) return { success: true, results: [] };

  const queryErr = validateLengths([[query, 'Search query', FIELD_LIMITS.general]]);
  if (queryErr) return { success: false, results: [] };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .where('status', '==', 'active')
      .get();

    const q = query.trim().toLowerCase();
    const results = [];

    snap.forEach(doc => {
      const d = doc.data();
      const name = (getDisplayName(d) || '').toLowerCase();
      const nxtId = (d.nxt_id || '').toLowerCase();

      if (name.includes(q) || nxtId.includes(q)) {
        results.push({
          uid: doc.id,
          fullName: getDisplayName(d),
          nxtId: d.nxt_id || '',
        });
      }
    });

    return { success: true, results: results.slice(0, 10) };
  } catch (error) {
    return { success: false, results: [] };
  }
}

/**
 * Atomically generates the next NXT ID (e.g. NXT0004).
 * Uses a Firestore counter document at counters/nxt_id_counter.
 */
export async function generateNxtId() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();
  const counterRef = db.collection('counters').doc('nxt_id_counter');

  try {
    const newId = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let current = 0;
      if (counterDoc.exists) {
        current = counterDoc.data().current || 0;
      }
      const next = current + 1;
      transaction.set(counterRef, { current: next, agency_id: caller.agencyId }, { merge: true });
      return next;
    });

    const nxtId = `NXT${String(newId).padStart(4, '0')}`;
    return { success: true, nxtId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Backfill NXT IDs for existing agents.
 * assignments: [{ agentDocId, nxtId }]
 * Also sets the counter to the highest number.
 */
export async function backfillNxtIds(assignments) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const batch = db.batch();
    let maxNum = 0;

    for (const { agentDocId, nxtId } of assignments) {
      batch.update(db.collection('agents').doc(agentDocId), { nxt_id: nxtId });
      const num = parseInt(nxtId.replace('NXT', ''), 10);
      if (num > maxNum) maxNum = num;
    }

    // Set counter to highest assigned number
    const counterRef = db.collection('counters').doc('nxt_id_counter');
    batch.set(counterRef, { current: maxNum }, { merge: true });

    await batch.commit();
    return { success: true, count: assignments.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function sendBrandedVerificationEmail({ email, name }) {
  try {
    // Uses Firebase Auth REST API to avoid admin.auth() ESM conflict with jose on Vercel
    const verificationLink = await generateVerificationLinkREST(email);

    await sendVerificationEmail({
      to: email,
      verificationLink,
      name: name || null,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Called during self-signup flow — no auth check (user has no session yet)
export async function createSelfSignupAgent({ uid, fullName, email, phone, agencyId, referredByAgentId }) {
  const lengthErr = validateLengths([
    [fullName, 'Full name', FIELD_LIMITS.name],
    [email, 'Email', FIELD_LIMITS.email],
    [phone, 'Phone', FIELD_LIMITS.phone],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  const emailErr = email ? validateEmail(email) : null;
  if (emailErr) return { success: false, error: emailErr };

  const phoneErr = phone ? validatePhone(phone) : null;
  if (phoneErr) return { success: false, error: phoneErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Generate NXT ID
    let nxtId = null;
    if (agencyId) {
      const counterRef = db.collection('counters').doc('nxt_id_counter');
      const newId = await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let current = 0;
        if (counterDoc.exists) {
          current = counterDoc.data().current || 0;
        }
        const next = current + 1;
        transaction.set(counterRef, { current: next, agency_id: agencyId }, { merge: true });
        return next;
      });
      nxtId = `NXT${String(newId).padStart(4, '0')}`;
    }

    // Build referral fields if a referral code resolved to an agent
    let referralFields = {};
    if (referredByAgentId) {
      const referrerSnap = await db.collection('agents').doc(referredByAgentId).get();
      if (referrerSnap.exists) {
        const referrerData = referrerSnap.data();
        referralFields = {
          upline_id: referredByAgentId,
          recruited_by: referredByAgentId,
          recruited_by_name: getDisplayName(referrerData) || null,
          hierarchyPath: (referrerData.hierarchyPath || `/${referredByAgentId}`) + `/${uid}`,
        };
      }
    }

    await db.collection('agents').doc(uid).set({
      agency_id: agencyId || null,
      upline_id: null,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || null,
      role: 'agent',
      is_owner: false,
      status: 'invited',
      agentLevel: 1,
      contractLevel: 'Unlicensed Associate',
      subscriptionStatus: 'trial',
      subscriptionStartDate: new Date().toISOString(),
      created_at: new Date().toISOString(),
      self_signup: true,
      ...(nxtId && { nxt_id: nxtId }),
      ...referralFields,
    });

    return { success: true, nxtId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteInvite(inviteId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const inviteDoc = await db.collection('invites').doc(inviteId).get();
    if (!inviteDoc.exists) return { success: false, error: 'Invite not found.' };

    // Verify invite belongs to caller's agency
    if (inviteDoc.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Invite not found.' };
    }

    await inviteDoc.ref.delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateAgentStatus(agentId, newStatus) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const validStatuses = ['active', 'suspended', 'invited', 'inactive'];
  if (!validStatuses.includes(newStatus)) {
    return { success: false, error: 'Invalid status.' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) {
      return { success: false, error: 'Agent not found.' };
    }
    if (agentSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent not found in your agency.' };
    }

    const agentData = agentSnap.data();
    const oldStatus = agentData.status;

    await db.collection('agents').doc(agentId).update({
      status: newStatus,
      ...(newStatus === 'active' && { approved_at: new Date().toISOString(), approved_by: caller.uid }),
    });

    // Log activity
    const { logActivity } = await import('@/lib/activityLogger');
    logActivity({
      category: 'status',
      action: 'update_agent_status',
      actorId: caller.uid,
      actorName: caller.fullName,
      actorNxtId: caller.nxtId,
      targetId: agentId,
      targetName: getDisplayName(agentData),
      description: `Changed status of ${getDisplayName(agentData)} from ${oldStatus} to ${newStatus}`,
      metadata: { oldStatus, newStatus },
    }).catch(() => {});

    // Send approval email when activating an agent
    if (newStatus === 'active' && agentData.email) {
      try {
        const { sendApprovalEmail } = await import('@/lib/email/resend');
        await sendApprovalEmail({
          to: agentData.email,
          name: getDisplayName(agentData) || agentData.preferred_name || '',
        });
      } catch (emailErr) {
        // approval email failed silently
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate a unique referral code from an agent's name.
 */
function buildReferralSlug(fullName) {
  const parts = fullName.trim().toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'agent';
  const first = parts[0];
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return first + lastInitial;
}

/**
 * Get or create a referral code for the caller.
 */
export async function getOrCreateReferralCode() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentSnap = await db.collection('agents').doc(caller.uid).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found.' };

    const agentData = agentSnap.data();

    // Already has a referral code
    if (agentData.referral_code) {
      return { success: true, referralCode: agentData.referral_code };
    }

    // Generate one from their name
    const baseSlug = buildReferralSlug(getDisplayName(agentData) || '');
    let slug = baseSlug;
    let attempt = 1;

    // Check for collisions
    while (true) {
      const existing = await db.collection('agents')
        .where('referral_code', '==', slug)
        .limit(1)
        .get();
      if (existing.empty) break;
      attempt++;
      slug = `${baseSlug}${attempt}`;
    }

    await db.collection('agents').doc(caller.uid).update({ referral_code: slug });
    return { success: true, referralCode: slug };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Resolve a referral code to an agent ID.
 * No auth check — called during self-signup before user has a session.
 */
export async function resolveReferralCode(code) {
  if (!code) return { success: false, error: 'No referral code.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('referral_code', '==', code.toLowerCase().trim())
      .limit(1)
      .get();

    if (snap.empty) return { success: false, error: 'Invalid referral link.' };

    const doc = snap.docs[0];
    const data = doc.data();

    return {
      success: true,
      agent: {
        id: doc.id,
        name: getDisplayName(data),
        nxtId: data.nxt_id || '',
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
