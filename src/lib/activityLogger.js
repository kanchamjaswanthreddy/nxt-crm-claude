'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';

/**
 * Log an activity event to the activity_logs collection.
 * Non-blocking — failures are swallowed so they never break the caller.
 *
 * @param {object} params
 * @param {string} params.category  - auth | onboarding | admin | documents | status | invite | navigation
 * @param {string} params.action    - e.g. 'login', 'approve_agent', 'upload_document'
 * @param {string} [params.actorId] - UID of the user performing the action
 * @param {string} [params.actorName]
 * @param {string} [params.actorNxtId]
 * @param {string} [params.targetId]   - UID/ID of the entity acted upon
 * @param {string} [params.targetName]
 * @param {string} [params.description] - human-readable summary
 * @param {object} [params.metadata]    - any extra context
 */
export async function logActivity({
  category,
  action,
  actorId = null,
  actorName = null,
  actorNxtId = null,
  targetId = null,
  targetName = null,
  description = '',
  metadata = {},
}) {
  // L-02: Retry once after 500ms on failure
  const write = async () => {
    const admin = getAdminApp();
    const db = admin.firestore();
    await db.collection('activity_logs').add({
      category,
      action,
      actorId,
      actorName,
      actorNxtId,
      targetId,
      targetName,
      description,
      metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  };

  try {
    await write();
  } catch (err) {
    console.error('[activityLogger] first attempt failed, retrying:', err?.message);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      await write();
    } catch (retryErr) {
      console.error('[activityLogger] retry failed:', retryErr?.message);
    }
  }
}
