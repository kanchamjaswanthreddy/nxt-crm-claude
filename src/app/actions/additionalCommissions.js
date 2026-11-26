'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

export async function fetchAdditionalCommissions() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    let q;
    const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

    if (isPrivileged) {
      q = db.collection('additionalCommissions').where('agencyId', '==', caller.agencyId);
    } else {
      q = db.collection('additionalCommissions')
        .where('agencyId', '==', caller.agencyId)
        .where('agentId', '==', caller.uid);
    }

    const snap = await q.get();
    const items = [];
    snap.forEach(doc => {
      const data = doc.data();
      items.push({
        id: doc.id,
        ...data,
        dateEarned: data.dateEarned ? (data.dateEarned.toDate ? data.dateEarned.toDate().toISOString() : data.dateEarned) : null,
        paidDate: data.paidDate ? (data.paidDate.toDate ? data.paidDate.toDate().toISOString() : data.paidDate) : null,
        createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null,
      });
    });

    return { success: true, commissions: items };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createAdditionalCommission(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const lengthErr = validateLengths([
    [data.description, 'Description', FIELD_LIMITS.description],
    [data.notes, 'Notes', FIELD_LIMITS.note],
    [data.category, 'Category', FIELD_LIMITS.general],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('additionalCommissions').add({
      agencyId: caller.agencyId,
      agentId: data.agentId,
      agentHierarchyPath: data.agentHierarchyPath || '',
      description: data.description || '',
      amount: Number(data.amount) || 0,
      category: data.category || 'other',
      dateEarned: data.dateEarned || null,
      status: data.status || 'pending',
      paidDate: null,
      notes: data.notes || '',
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateAdditionalCommission(id, data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify record belongs to caller's agency
    const docSnap = await db.collection('additionalCommissions').doc(id).get();
    if (!docSnap.exists) return { success: false, error: 'Record not found.' };
    if (docSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Not authorized.' };

    const updateData = { ...data };
    delete updateData.id;
    delete updateData.agencyId; // prevent overwriting agency
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('additionalCommissions').doc(id).update(updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
