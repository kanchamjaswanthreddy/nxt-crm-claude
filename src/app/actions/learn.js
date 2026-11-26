'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

export async function fetchLearningResources() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('learningResources')
      .where('agencyId', '==', caller.agencyId)
      .get();

    const resources = [];
    snap.forEach(doc => {
      const data = doc.data();
      resources.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      });
    });

    resources.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
    return { success: true, resources };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createLearningResource(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const lengthErr = validateLengths([
    [data.title, 'Title', FIELD_LIMITS.subject],
    [data.description, 'Description', FIELD_LIMITS.description],
    [data.url, 'URL', FIELD_LIMITS.url],
    [data.category, 'Category', FIELD_LIMITS.general],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection('learningResources').add({
      agencyId: caller.agencyId,
      title: data.title,
      description: data.description || '',
      category: data.category || 'training',
      contentType: data.contentType || 'link',
      url: data.url || '',
      thumbnailUrl: data.thumbnailUrl || null,
      sortOrder: Number(data.sortOrder) || 0,
      requiredForOnboarding: data.requiredForOnboarding || false,
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateLearningResource(resourceId, data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the resource belongs to the caller's agency
    const resourceSnap = await db.collection('learningResources').doc(resourceId).get();
    if (!resourceSnap.exists || resourceSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Resource not found.' };
    }

    const updateData = { ...data };
    delete updateData.id;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('learningResources').doc(resourceId).update(updateData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteLearningResource(resourceId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the resource belongs to the caller's agency
    const resourceSnap = await db.collection('learningResources').doc(resourceId).get();
    if (!resourceSnap.exists || resourceSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Resource not found.' };
    }

    await db.collection('learningResources').doc(resourceId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
