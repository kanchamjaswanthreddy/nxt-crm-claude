'use server';

import { AGENT_LEVELS } from '@/lib/constants';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { sendInviteEmail } from '@/lib/email/resend';
import { requireAdmin, requireUser, verifyFirebaseIdToken } from '@/lib/serverAuth';
import crypto from 'crypto';
import { validateEmail } from '@/lib/validation';

// Cleans up an orphan Firebase Auth user (exists in Auth but has no agent doc)
// Note: Uses Firebase Auth REST API to avoid admin.auth() ESM conflict with jose on Vercel
// Called during invite flow before user has session — no auth check
export async function cleanupOrphanAuthUser(email) {
  if (!email) return { success: false, error: 'No email provided.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Check if any agent doc exists with this email
    const agentSnap = await db.collection('agents')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!agentSnap.empty) {
      return { success: false, error: 'Active account exists for this email.' };
    }

    // No agent doc found — any auth user with this email is orphaned.
    // We can't delete via admin.auth() due to ESM conflict, but the orphan
    // won't block new signups since Firebase allows creating accounts
    // with the same email if the old one isn't linked to any app data.
    return { success: true, message: 'No active agent found for this email.' };
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to cleanup.' };
  }
}


// Called during invite flow before user has session — no auth check
export async function validateInviteToken(token) {
  if (!token) return { valid: false, error: 'No invite token provided.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snapshot = await db.collection('invites').where('token', '==', token).limit(1).get();

    if (snapshot.empty) {
      return { valid: false, error: 'Invalid invite link. Please ask your admin to send a new one.' };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (data.status === 'accepted') {
      return { valid: false, error: 'This invite has already been used. Try signing in instead.' };
    }

    if (data.status !== 'pending') {
      return { valid: false, error: 'This invite is no longer valid. Please ask your admin to send a new one.' };
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false, error: 'This invite has expired. Please ask your admin to send a new one.' };
    }

    return {
      valid: true,
      invite: {
        id: doc.id,
        email: data.email,
        role: data.role,
        is_owner: data.is_owner || false,
        agency_id: data.agency_id,
        upline_id: data.upline_id || null,
        inviter_name: data.inviter_name || null,
        agentLevel: data.agentLevel || 1,
        commissionOverrides: data.commissionOverrides || [],
      }
    };
  } catch (err) {
    return { valid: false, error: 'Error validating invite. Please try again.' };
  }
}

/**
 * Finish an invited person's sign-up on the server.
 *
 * The browser only creates the sign-in (email + password). Everything that decides what the new person is allowed
 * to do - role, owner flag, upline, level, NXT ID, commission overrides - is read here from the invite itself, never
 * from what the browser sends. The caller proves who they are with their sign-in token, and it must be the same
 * email the invite was sent to.
 */
export async function completeInviteSignup(token, idToken, fullName) {
  if (!token || !idToken) return { success: false, error: 'This invite link is not valid.' };
  const name = String(fullName || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (name.length < 2) return { success: false, error: 'Please enter your full name.' };

  const admin = getAdminApp();
  const db = admin.firestore();
  try {
    let decoded;
    try { decoded = await verifyFirebaseIdToken(idToken); } catch { return { success: false, error: 'Your sign-in could not be confirmed. Please try again.' }; }
    const uid = decoded.uid; const email = String(decoded.email || '').toLowerCase();

    const snap = await db.collection('invites').where('token', '==', token).limit(1).get();
    if (snap.empty) return { success: false, error: 'Invalid invite link. Please ask your admin to send a new one.' };
    const inviteRef = snap.docs[0].ref;

    const agencyDefault = process.env.NEXT_PUBLIC_DEFAULT_AGENCY_ID || 'JHdkqlkDcXFKzHl46FG7';
    const agentRef = db.collection('agents').doc(uid);
    const counterRef = db.collection('counters').doc('nxt_id_counter');

    const result = await db.runTransaction(async (transaction) => {
      const [inviteSnap, agentSnap, counterSnap] = await Promise.all([transaction.get(inviteRef), transaction.get(agentRef), transaction.get(counterRef)]);
      const invite = inviteSnap.data();
      if (invite.status === 'accepted') return { error: 'This invite has already been used. Try signing in instead.' };
      if (invite.status !== 'pending') return { error: 'This invite is no longer valid. Please ask your admin to send a new one.' };
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'This invite has expired. Please ask your admin to send a new one.' };
      if (String(invite.email || '').toLowerCase() !== email) return { error: 'This invite was sent to a different email address.' };
      if (agentSnap.exists) return { error: 'This account is already set up. Try signing in instead.' };

      const agencyId = invite.agency_id || agencyDefault;
      let hierarchyPath = `/${uid}`;
      if (invite.upline_id) {
        const up = await transaction.get(db.collection('agents').doc(invite.upline_id));
        hierarchyPath = `${(up.exists && up.data().hierarchyPath) || `/${invite.upline_id}`}/${uid}`;
      }
      const level = Number(invite.agentLevel) || 1;
      const levelInfo = AGENT_LEVELS.find(l => l.level === level);
      const next = ((counterSnap.exists && counterSnap.data().current) || 0) + 1;
      const parts = name.split(' ');
      const now = new Date().toISOString();

      transaction.set(counterRef, { current: next, agency_id: agencyId }, { merge: true });
      transaction.set(agentRef, {
        agency_id: agencyId,
        upline_id: invite.upline_id || null,
        hierarchyPath,
        first_name: parts[0] || '',
        middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
        last_name: parts.length > 1 ? parts[parts.length - 1] : '',
        full_name: name,
        email: invite.email,
        role: invite.role || 'agent',
        is_owner: invite.is_owner === true,
        status: 'invited',
        agentLevel: level,
        contractLevel: levelInfo?.title || 'Unlicensed Associate',
        subscriptionStatus: 'trial',
        subscriptionStartDate: now,
        email_verified_at: now,
        created_at: now,
        nxt_id: `NXT${String(next).padStart(4, '0')}`,
        ...(invite.inviter_name && { recruited_by: invite.inviter_name }),
      });
      transaction.update(inviteRef, { status: 'accepted', accepted_at: now, accepted_by_uid: uid, signup_email: invite.email });

      // Commission overrides chosen when the invite was sent.
      const overrides = Array.isArray(invite.commissionOverrides) ? invite.commissionOverrides : [];
      let total = 0; const clean = [];
      for (const o of overrides) {
        const pct = Number(o?.percent);
        if (!o?.beneficiaryId || o.beneficiaryId === uid || !Number.isFinite(pct) || pct <= 0 || pct > 100) continue;
        total += pct; if (total > 100) break;
        clean.push({ beneficiaryId: String(o.beneficiaryId), beneficiaryName: String(o.beneficiaryName || ''), percent: pct });
      }
      const stamp = new Date();
      clean.forEach(o => transaction.set(db.collection('commissionOverrides').doc(), { agentId: uid, agentName: name, ...o, agencyId, createdAt: stamp, createdBy: invite.invited_by_uid || uid, updatedAt: stamp, updatedBy: invite.invited_by_uid || uid }));
      return { ok: true };
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true };
  } catch (err) {
    console.error('completeInviteSignup failed', err);
    return { success: false, error: 'We could not finish setting up your account. Please try again.' };
  }
}

// Called during invite flow before user has session — no auth check
export async function acceptInvite(token, { uid, signupEmail } = {}) {
  if (!token) return { success: false, error: 'No token.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snapshot = await db.collection('invites').where('token', '==', token).limit(1).get();
    if (snapshot.empty) return { success: false, error: 'Invite not found.' };

    const doc = snapshot.docs[0];
    const inviteData = doc.data();

    // L-10: Check expiry
    if (inviteData.expires_at && new Date(inviteData.expires_at) < new Date()) {
      return { success: false, error: 'This invite has expired. Please ask your admin to send a new one.' };
    }

    const updateData = {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    };
    if (uid) updateData.accepted_by_uid = uid;
    if (signupEmail) updateData.signup_email = signupEmail;

    await doc.ref.update(updateData);

    return { success: true };
  } catch (err) {
    return { success: false, error: 'Failed to accept invite.' };
  }
}

export async function getInviteByEmail(email) {
  if (!email) return { success: false, error: 'No email.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snapshot = await db.collection('invites')
      .where('email', '==', email)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return { success: true, invite: null };

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      success: true,
      invite: {
        id: doc.id,
        agency_id: data.agency_id,
        role: data.role,
        agentLevel: data.agentLevel,
        upline_id: data.upline_id,
        inviter_name: data.inviter_name || null,
        is_owner: data.is_owner || false,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function markInviteAcceptedByEmail(email) {
  if (!email) return { success: false, error: 'No email.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snapshot = await db.collection('invites')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (snapshot.empty) return { success: true }; // No pending invite, nothing to do

    const inviteDoc = snapshot.docs[0];
    await inviteDoc.ref.update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function linkInviteToAgent(inviteId, agentId) {
  if (!inviteId || !agentId) return { success: false, error: 'Missing invite or agent ID.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const [inviteDoc, agentDoc] = await Promise.all([
      db.collection('invites').doc(inviteId).get(),
      db.collection('agents').doc(agentId).get(),
    ]);

    if (!inviteDoc.exists) return { success: false, error: 'Invite not found.' };
    if (!agentDoc.exists) return { success: false, error: 'Agent not found.' };

    const agentData = agentDoc.data();
    await inviteDoc.ref.update({
      accepted_by_uid: agentId,
      signup_email: agentData.email || '',
      status: 'accepted',
      accepted_at: inviteDoc.data().accepted_at || new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'Failed to link.' };
  }
}

export async function resendInvite(inviteId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const inviteDoc = await db.collection('invites').doc(inviteId).get();
    if (!inviteDoc.exists) return { success: false, error: 'Invite not found.' };

    const data = inviteDoc.data();

    // Verify invite belongs to caller's agency
    if (data.agency_id !== caller.agencyId) {
      return { success: false, error: 'Invite not found.' };
    }

    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    await inviteDoc.ref.update({
      token: newToken,
      status: 'pending',
      expires_at: newExpiry.toISOString(),
      resent_at: new Date().toISOString(),
    });

    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${newToken}`;

    // Send invite email via Resend
    let emailSent = false;
    let emailError = null;
    try {
      let agencyName = 'NXT Financial Group';
      try {
        const agencyDoc = await db.collection('agencies').doc(data.agency_id).get();
        if (agencyDoc.exists) {
          agencyName = agencyDoc.data()?.name || agencyName;
        }
      } catch (_) {}

      await sendInviteEmail({
        to: data.email,
        inviteLink,
        role: data.role,
        agencyName,
      });
      emailSent = true;
    } catch (err) {
      emailError = err?.message || 'Failed to send email';
    }

    return { success: true, inviteLink, emailSent, emailError };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createInvite(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const { email, role, upline_id, agentLevel, commissionOverrides } = data;
  const agency_id = caller.agencyId;

  if (!email || !role) {
    return { success: false, error: 'Missing required fields for invite.' };
  }

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: emailErr };

  // Check if an agent with this email already exists in the agency
  try {
    const existingAgent = await db.collection('agents')
      .where('email', '==', email)
      .where('agency_id', '==', agency_id)
      .limit(1)
      .get();
    if (!existingAgent.empty) {
      return { success: false, error: 'An agent with this email already exists in the agency.' };
    }
  } catch (err) {
    return { success: false, error: 'Could not verify email, please try again.' };
  }

  // Check if this email already has an active agent account (Firestore-only, no admin.auth())
  try {
    const allAgentsWithEmail = await db.collection('agents')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (!allAgentsWithEmail.empty) {
      return { success: false, error: 'This email is already registered with an active account.' };
    }
  } catch (err) {
    return { success: false, error: 'Could not verify email, please try again.' };
  }

  // Clean up any old invites for this email in this agency
  try {
    const oldInvites = await db.collection('invites')
      .where('email', '==', email)
      .where('agency_id', '==', agency_id)
      .get();
    if (!oldInvites.empty) {
      const batch = db.batch();
      oldInvites.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (_) {}

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    const isOwnerInvite = role === 'owner';

    // Look up inviter's name and NXT ID from their agent doc
    let inviterName = caller.fullName || null;
    let inviterNxtId = caller.nxtId || null;

    const inviteDoc = {
      agency_id,
      email,
      role: isOwnerInvite ? 'admin' : role,
      is_owner: isOwnerInvite,
      upline_id: upline_id || caller.uid,
      invited_by_uid: caller.uid,
      inviter_name: inviterName,
      inviter_nxt_id: inviterNxtId,
      agentLevel: agentLevel || 1,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    };

    // Store commission overrides if provided
    if (Array.isArray(commissionOverrides) && commissionOverrides.length > 0) {
      inviteDoc.commissionOverrides = commissionOverrides.map(o => ({
        beneficiaryId: o.beneficiaryId,
        beneficiaryName: o.beneficiaryName || '',
        percent: parseFloat(o.percent) || 0,
      }));
    }

    const inviteRef = await db.collection('invites').add(inviteDoc);

    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${token}`;

    // Send invite email via Resend
    let emailSent = false;
    let emailError = null;
    try {
      // Look up agency name for the email
      let agencyName = 'NXT Financial Group';
      try {
        const agencyDoc = await db.collection('agencies').doc(agency_id).get();
        if (agencyDoc.exists) {
          agencyName = agencyDoc.data()?.name || agencyName;
        }
      } catch (_) {}

      await sendInviteEmail({
        to: email,
        inviteLink,
        role: role,
        agencyName,
      });
      emailSent = true;
    } catch (err) {
      emailError = err?.message || 'Failed to send email';
    }

    // Log activity
    const { logActivity } = await import('@/lib/activityLogger');
    logActivity({
      category: 'invite',
      action: 'create_invite',
      actorId: caller.uid,
      actorName: inviterName,
      actorNxtId: inviterNxtId,
      targetName: email,
      description: `Invited ${email} as ${role} (level ${agentLevel || 1})`,
      metadata: { role, agentLevel: agentLevel || 1, emailSent },
    }).catch(() => {});

    return { success: true, inviteLink, id: inviteRef.id, emailSent, emailError };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
