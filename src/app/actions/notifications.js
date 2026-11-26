'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

/**
 * Fetch recent notifications for the current user.
 * Returns the 20 most recent notifications.
 */
export async function fetchNotifications() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('notifications')
      .where('userId', '==', caller.uid)
      .where('agencyId', '==', caller.agencyId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const notifications = [];
    snap.forEach(doc => {
      const d = doc.data();
      notifications.push({
        id: doc.id,
        type: d.type || 'info',
        message: d.message || '',
        href: d.href || null,
        read: !!d.read,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return { success: true, notifications };
  } catch (err) {
    // Collection may not exist yet — return empty
    if (err.code === 5 || err.message?.includes('index')) {
      return { success: true, notifications: [] };
    }
    return { success: false, error: err.message };
  }
}

/**
 * Mark all notifications as read for the current user.
 */
export async function markNotificationsRead() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('notifications')
      .where('userId', '==', caller.uid)
      .where('agencyId', '==', caller.agencyId)
      .where('read', '==', false)
      .limit(50)
      .get();

    if (snap.empty) return { success: true };

    const batch = db.batch();
    snap.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Create a notification for a user. Called from other server actions.
 */
export async function createNotification({ userId, agencyId, type, message, href }) {
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.collection('notifications').add({
      userId,
      agencyId,
      type: type || 'info',
      message,
      href: href || null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
