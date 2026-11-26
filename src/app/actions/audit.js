'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireAdmin } from '@/lib/serverAuth';

export async function writeAuditLog(action, targetType, targetId, metadata = {}) {
  let caller;
  try { caller = await requireAdmin(); } catch { return; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.collection('AuditLog').add({
      agencyId: caller.agencyId,
      actorAgentId: caller.uid,
      action,
      targetType,
      targetId,
      metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    // In production, this should alert Sentry directly if audit log fails.
  }
}
