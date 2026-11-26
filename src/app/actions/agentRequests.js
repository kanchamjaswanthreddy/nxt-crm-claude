'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

export async function createAgentRequest({ targetAgentId, requestType, title, description }) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!targetAgentId || !title || !requestType) {
    return { success: false, error: 'Missing required fields.' };
  }

  const lengthErr = validateLengths([
    [title, 'Title', FIELD_LIMITS.subject],
    [description, 'Description', FIELD_LIMITS.description],
    [requestType, 'Request type', FIELD_LIMITS.general],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const targetSnap = await db.collection('agents').doc(targetAgentId).get();
    if (!targetSnap.exists) {
      return { success: false, error: 'Target agent not found.' };
    }
    if (targetSnap.data().agency_id !== caller.agencyId) {
      return { success: false, error: 'Target agent not found in your agency.' };
    }

    const ref = await db.collection('agentRequests').add({
      agencyId: caller.agencyId,
      targetAgentId,
      requestType,
      title,
      description: description || '',
      status: 'pending',
      createdBy: caller.uid,
      createdByName: caller.fullName || 'Admin',
      createdAt: new Date().toISOString(),
      completedAt: null,
      completedNote: null,
    });

    return { success: true, id: ref.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchAgentRequests() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    let snap;
    const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

    if (isPrivileged) {
      // Admins see all requests in the agency
      snap = await db.collection('agentRequests')
        .where('agencyId', '==', caller.agencyId)
        .orderBy('createdAt', 'desc')
        .get();
    } else {
      // Agents see only their own requests
      snap = await db.collection('agentRequests')
        .where('targetAgentId', '==', caller.uid)
        .orderBy('createdAt', 'desc')
        .get();
    }

    const requests = [];
    snap.forEach(d => {
      requests.push({ id: d.id, ...d.data() });
    });

    return { success: true, requests };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function completeAgentRequest(requestId, note) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!requestId) return { success: false, error: 'Missing fields.' };

  const noteErr = validateLengths([[note, 'Note', FIELD_LIMITS.note]]);
  if (noteErr) return { success: false, error: noteErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const reqDoc = await db.collection('agentRequests').doc(requestId).get();
    if (!reqDoc.exists) return { success: false, error: 'Request not found.' };

    const data = reqDoc.data();
    const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

    if (data.targetAgentId !== caller.uid && !isPrivileged) {
      return { success: false, error: 'Not authorized.' };
    }

    await reqDoc.ref.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedNote: note || null,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function dismissAgentRequest(requestId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!requestId) return { success: false, error: 'Missing fields.' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const reqDoc = await db.collection('agentRequests').doc(requestId).get();
    if (!reqDoc.exists) return { success: false, error: 'Request not found.' };

    if (reqDoc.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Request not found.' };
    }

    await reqDoc.ref.update({
      status: 'dismissed',
      dismissedAt: new Date().toISOString(),
      dismissedBy: caller.uid,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
