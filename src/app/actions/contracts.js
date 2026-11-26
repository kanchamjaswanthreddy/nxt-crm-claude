'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

export async function fetchContracts() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const isAdmin = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

  try {
    let snap;
    if (isAdmin) {
      snap = await db.collection('agentContracts')
        .where('agencyId', '==', caller.agencyId)
        .get();
    } else {
      snap = await db.collection('agentContracts')
        .where('agencyId', '==', caller.agencyId)
        .where('agentId', '==', caller.uid)
        .get();
    }

    const contracts = [];
    snap.forEach(doc => {
      contracts.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, contracts };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createContract(data) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const lengthErr = validateLengths([
    [data.contractNumber, 'Contract number', FIELD_LIMITS.policyNumber],
    [data.contractLevel, 'Contract level', FIELD_LIMITS.general],
    [data.notes, 'Notes', FIELD_LIMITS.note],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('agentContracts').add({
      agencyId: caller.agencyId,
      agentId: data.agentId,
      agentHierarchyPath: data.agentHierarchyPath || '',
      carrierId: data.carrierId,
      contractNumber: data.contractNumber || '',
      contractLevel: data.contractLevel || '',
      status: data.status || 'pending',
      effectiveDate: data.effectiveDate || '',
      terminationDate: data.terminationDate || null,
      appointedStates: data.appointedStates || [],
      productLines: data.productLines || [],
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateContract(contractId, data) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify contract belongs to caller's agency
    const contractSnap = await db.collection('agentContracts').doc(contractId).get();
    if (!contractSnap.exists || contractSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Contract not found.' };
    }

    const updateData = { ...data };
    delete updateData.id;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('agentContracts').doc(contractId).update(updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
