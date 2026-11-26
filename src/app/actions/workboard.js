'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireAdmin } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, isRateLimited, FIELD_LIMITS } from '@/lib/validation';

const VALID_PRIORITIES = ['urgent', 'high', 'normal', 'low'];
const VALID_STATUSES = ['open', 'in_progress', 'done'];
const VALID_CATEGORIES = ['crm', 'website', 'client_request', 'general'];

/**
 * Create a new work board task.
 */
export async function createWorkTask(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  if (isRateLimited(`worktask-create:${caller.uid}`, 30, 3600000)) {
    return { success: false, error: 'Too many tasks created. Please try again later.' };
  }

  const { title, description, assignedTo, priority, category, dueDate, attachments } = data;

  const lengthErr = validateLengths([
    [title, 'Title', FIELD_LIMITS.subject],
    [description, 'Description', FIELD_LIMITS.description],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  if (!title?.trim()) return { success: false, error: 'Title is required' };
  if (!assignedTo) return { success: false, error: 'Assignee is required' };

  try {
    // Verify assignee is an admin in the same agency
    const assigneeSnap = await db.collection('agents').doc(assignedTo).get();
    if (!assigneeSnap.exists) return { success: false, error: 'Assignee not found' };
    const assigneeData = assigneeSnap.data();
    if (assigneeData.agency_id !== caller.agencyId) return { success: false, error: 'Assignee not in your agency' };

    // Get caller name
    const callerSnap = await db.collection('agents').doc(caller.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};

    const taskDoc = {
      title: title.trim(),
      description: (description || '').trim(),
      assignedTo,
      assignedToName: getDisplayName(assigneeData) || assigneeData.email || '',
      assignedBy: caller.uid,
      assignedByName: getDisplayName(callerData) || callerData.email || '',
      priority: VALID_PRIORITIES.includes(priority) ? priority : 'normal',
      category: VALID_CATEGORIES.includes(category) ? category : 'general',
      status: 'open',
      dueDate: dueDate || null,
      attachments: Array.isArray(attachments) ? attachments.map(a => ({
        name: a.name || 'file',
        url: a.url || '',
        size: a.size || 0,
        type: a.type || '',
      })) : [],
      comments: [],
      agencyId: caller.agencyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = await db.collection('work_tasks').add(taskDoc);
    return { success: true, task: { id: ref.id, ...taskDoc } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all work board tasks for the agency.
 */
export async function fetchWorkTasks() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('work_tasks')
      .where('agencyId', '==', caller.agencyId)
      .orderBy('createdAt', 'desc')
      .get();

    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, tasks, currentUserId: caller.uid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a work task (status, priority, details).
 */
export async function updateWorkTask(taskId, updates) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const taskRef = db.collection('work_tasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) return { success: false, error: 'Task not found' };
    if (taskSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Permission denied' };

    const allowed = {};
    if (updates.title !== undefined) allowed.title = updates.title.trim();
    if (updates.description !== undefined) allowed.description = updates.description.trim();
    if (updates.priority && VALID_PRIORITIES.includes(updates.priority)) allowed.priority = updates.priority;
    if (updates.status && VALID_STATUSES.includes(updates.status)) allowed.status = updates.status;
    if (updates.category && VALID_CATEGORIES.includes(updates.category)) allowed.category = updates.category;
    if (updates.dueDate !== undefined) allowed.dueDate = updates.dueDate;
    if (updates.attachments !== undefined) {
      allowed.attachments = Array.isArray(updates.attachments) ? updates.attachments : [];
    }
    allowed.updatedAt = new Date().toISOString();

    await taskRef.update(allowed);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Add a comment to a task.
 */
export async function addTaskComment(taskId, text) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!text?.trim()) return { success: false, error: 'Comment text is required' };

  const lengthErr = validateLengths([
    [text, 'Comment', FIELD_LIMITS.note],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const taskRef = db.collection('work_tasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) return { success: false, error: 'Task not found' };
    if (taskSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Permission denied' };

    const callerSnap = await db.collection('agents').doc(caller.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};

    const comment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      authorId: caller.uid,
      authorName: getDisplayName(callerData) || callerData.email || '',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const existing = taskSnap.data().comments || [];
    await taskRef.update({
      comments: [...existing, comment],
      updatedAt: new Date().toISOString(),
    });

    return { success: true, comment };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a work task.
 */
export async function deleteWorkTask(taskId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const taskRef = db.collection('work_tasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) return { success: false, error: 'Task not found' };
    if (taskSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Permission denied' };

    await taskRef.delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch admin users for assignment dropdown.
 */
export async function fetchAdminUsers() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const admins = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.role === 'admin' || data.role === 'it_engineer' || data.is_owner) {
        admins.push({
          id: d.id,
          name: getDisplayName(data) || data.email || '',
          role: data.role,
          is_owner: data.is_owner || false,
        });
      }
    });

    return { success: true, admins, currentUserId: caller.uid };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
