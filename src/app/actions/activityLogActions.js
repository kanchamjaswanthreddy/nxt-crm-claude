'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireAdmin } from '@/lib/serverAuth';

/**
 * Fetch activity logs with optional category filter and pagination.
 */
export async function fetchActivityLogs({ category = null, limit = 50, beforeTimestamp = null }) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized', logs: [] }; }

  try {
    const admin = getAdminApp();
    const db = admin.firestore();

    let query = db.collection('activity_logs')
      .where('agencyId', '==', caller.agencyId)
      .orderBy('timestamp', 'desc');

    if (category) {
      query = query.where('category', '==', category);
    }

    if (beforeTimestamp) {
      query = query.startAfter(new Date(beforeTimestamp));
    }

    query = query.limit(limit);

    const snap = await query.get();
    const logs = [];
    snap.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || null,
      });
    });

    return { success: true, logs };
  } catch (error) {
    return { success: false, error: error.message, logs: [] };
  }
}
