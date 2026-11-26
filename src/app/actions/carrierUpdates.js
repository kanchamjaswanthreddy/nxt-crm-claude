'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

export async function fetchCarrierUpdates() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('carrierUpdates')
      .where('agencyId', '==', caller.agencyId)
      .orderBy('publishedAt', 'desc')
      .get();

    const updates = [];
    snap.forEach(doc => {
      const data = doc.data();
      updates.push({
        id: doc.id,
        ...data,
        publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate().toISOString() : data.publishedAt,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      });
    });

    return { success: true, updates };
  } catch (error) {
    // If index doesn't exist yet, try without orderBy
    if (error.code === 9) {
      try {
        const admin2 = getAdminApp();
        const db2 = admin2.firestore();
        const snap = await db2.collection('carrierUpdates')
          .where('agencyId', '==', caller.agencyId)
          .get();
        const updates = [];
        snap.forEach(doc => {
          const data = doc.data();
          updates.push({
            id: doc.id,
            ...data,
            publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate().toISOString() : data.publishedAt,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          });
        });
        updates.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
        return { success: true, updates };
      } catch (e2) {
        return { success: false, error: e2.message };
      }
    }
    return { success: false, error: error.message };
  }
}

export async function createCarrierUpdate(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const lengthErr = validateLengths([
    [data.title, 'Title', FIELD_LIMITS.subject],
    [data.body, 'Body', FIELD_LIMITS.description],
    [data.category, 'Category', FIELD_LIMITS.general],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('carrierUpdates').add({
      agencyId: caller.agencyId,
      carrierId: data.carrierId || null,
      title: data.title,
      body: data.body,
      category: data.category || 'announcement',
      priority: data.priority || 'normal',
      publishedAt: now,
      expiresAt: data.expiresAt || null,
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteCarrierUpdate(updateId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the update belongs to the caller's agency
    const updateSnap = await db.collection('carrierUpdates').doc(updateId).get();
    if (!updateSnap.exists || updateSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Update not found.' };
    }

    await db.collection('carrierUpdates').doc(updateId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
