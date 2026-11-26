'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, isRateLimited, FIELD_LIMITS } from '@/lib/validation';
import { sendTicketUpdateEmail } from '@/lib/email/resend';

const VALID_CATEGORIES = ['general', 'billing', 'technical', 'compliance', 'onboarding', 'marketing', 'other'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

/**
 * Check if the caller is a help desk user (admin/owner/it_engineer OR member of help-desk group).
 */
async function checkHelpDeskAccess(caller) {
  if (caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer') {
    return true;
  }
  const admin = getAdminApp();
  const db = admin.firestore();
  const snap = await db.collection('group_members')
    .where('groupId', '==', 'help-desk')
    .where('agentId', '==', caller.uid)
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * Get the next ticket number (NXTH-0001, NXTH-0002, ...).
 */
async function getNextTicketNumber(db, agencyId) {
  const snap = await db.collection('help_tickets')
    .where('agencyId', '==', agencyId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return 'NXTH-0001';

  const lastNumber = snap.docs[0].data().ticketNumber || 'NXTH-0000';
  const num = parseInt(lastNumber.replace(/^NXT[H]?-/, ''), 10) || 0;
  return `NXTH-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Send a ticket update notification email (fire-and-forget).
 */
function notifyTicketCreator(ticket, updateType, detail) {
  if (!ticket.createdByEmail) return;
  try {
    sendTicketUpdateEmail({
      to: ticket.createdByEmail,
      name: ticket.createdByName,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      updateType,
      detail,
    }).catch(() => {});
  } catch {}
}

/**
 * Create a new help ticket. Any authenticated user can create.
 */
export async function createTicket({ subject, description, category, priority, attachments }) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!subject?.trim()) return { success: false, error: 'Subject is required' };
  if (!description?.trim()) return { success: false, error: 'Description is required' };

  const lengthErr = validateLengths([
    [subject, 'Subject', FIELD_LIMITS.subject],
    [description, 'Description', FIELD_LIMITS.description],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  if (isRateLimited(`ticket-create:${caller.uid}`, 20, 3600000)) {
    return { success: false, error: 'Too many tickets created. Please try again later.' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const callerSnap = await db.collection('agents').doc(caller.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};

    const ticketNumber = await getNextTicketNumber(db, caller.agencyId);
    const now = new Date().toISOString();

    const ticketDoc = {
      ticketNumber,
      subject: subject.trim(),
      description: description.trim(),
      category: VALID_CATEGORIES.includes(category) ? category : 'general',
      priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
      status: 'open',
      createdBy: caller.uid,
      createdByName: getDisplayName(callerData) || caller.email,
      createdByEmail: caller.email,
      assignedTo: null,
      assignedToName: null,
      agencyId: caller.agencyId,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      comments: [],
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      closedAt: null,
    };

    const ref = await db.collection('help_tickets').add(ticketDoc);
    return { success: true, ticket: { id: ref.id, ...ticketDoc } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch tickets created by the current user.
 */
export async function fetchMyTickets() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('help_tickets')
      .where('createdBy', '==', caller.uid)
      .where('agencyId', '==', caller.agencyId)
      .orderBy('createdAt', 'desc')
      .get();

    const tickets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, tickets };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all tickets for the agency. Help desk members + admins only.
 */
export async function fetchAllTickets(filters = {}) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const hasAccess = await checkHelpDeskAccess(caller);
  if (!hasAccess) return { success: false, error: 'Permission denied' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    let query = db.collection('help_tickets')
      .where('agencyId', '==', caller.agencyId)
      .orderBy('createdAt', 'desc');

    const snap = await query.get();

    let tickets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filtering (Firestore doesn't support multiple inequality/in filters easily)
    if (filters.status) {
      tickets = tickets.filter(t => t.status === filters.status);
    }
    if (filters.category) {
      tickets = tickets.filter(t => t.category === filters.category);
    }
    if (filters.priority) {
      tickets = tickets.filter(t => t.priority === filters.priority);
    }

    return { success: true, tickets };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update ticket status. Help desk can set any status; creator can reopen from resolved.
 */
export async function updateTicketStatus({ ticketId, status }) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!ticketId) return { success: false, error: 'Ticket ID required' };
  if (!VALID_STATUSES.includes(status)) return { success: false, error: 'Invalid status' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const ticketSnap = await db.collection('help_tickets').doc(ticketId).get();
    if (!ticketSnap.exists) return { success: false, error: 'Ticket not found' };

    const ticket = ticketSnap.data();
    if (ticket.agencyId !== caller.agencyId) return { success: false, error: 'Ticket not found' };

    const isHelpDesk = await checkHelpDeskAccess(caller);
    const isCreator = ticket.createdBy === caller.uid;

    // Creator can only reopen a resolved ticket
    if (!isHelpDesk) {
      if (!isCreator) return { success: false, error: 'Permission denied' };
      if (status !== 'open' || ticket.status !== 'resolved') {
        return { success: false, error: 'You can only reopen a resolved ticket' };
      }
    }

    const updates = { status, updatedAt: new Date().toISOString() };
    if (status === 'resolved') updates.resolvedAt = new Date().toISOString();
    if (status === 'closed') updates.closedAt = new Date().toISOString();

    await db.collection('help_tickets').doc(ticketId).update(updates);

    const statusLabels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
    notifyTicketCreator(ticket, 'Status Updated', `Status changed to ${statusLabels[status] || status}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Assign a ticket to a help desk member. Help desk only.
 */
export async function assignTicket({ ticketId, assignedTo, assignedToName }) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const hasAccess = await checkHelpDeskAccess(caller);
  if (!hasAccess) return { success: false, error: 'Permission denied' };

  if (!ticketId) return { success: false, error: 'Ticket ID required' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const ticketSnap = await db.collection('help_tickets').doc(ticketId).get();
    if (!ticketSnap.exists) return { success: false, error: 'Ticket not found' };
    if (ticketSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Ticket not found' };

    await db.collection('help_tickets').doc(ticketId).update({
      assignedTo: assignedTo || null,
      assignedToName: assignedToName || null,
      updatedAt: new Date().toISOString(),
    });

    const ticket = ticketSnap.data();
    notifyTicketCreator(ticket, 'Ticket Assigned', `Assigned to ${assignedToName || 'Unassigned'}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Add a comment to a ticket. Creator + help desk members can comment.
 */
export async function addTicketComment({ ticketId, text }) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!ticketId) return { success: false, error: 'Ticket ID required' };
  if (!text?.trim()) return { success: false, error: 'Comment text required' };

  const lengthErr = validateLengths([
    [text, 'Comment', FIELD_LIMITS.note],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const ticketSnap = await db.collection('help_tickets').doc(ticketId).get();
    if (!ticketSnap.exists) return { success: false, error: 'Ticket not found' };

    const ticket = ticketSnap.data();
    if (ticket.agencyId !== caller.agencyId) return { success: false, error: 'Ticket not found' };

    const isHelpDesk = await checkHelpDeskAccess(caller);
    const isCreator = ticket.createdBy === caller.uid;

    if (!isHelpDesk && !isCreator) return { success: false, error: 'Permission denied' };

    const callerSnap = await db.collection('agents').doc(caller.uid).get();
    const callerData = callerSnap.exists ? callerSnap.data() : {};

    const comment = {
      uid: caller.uid,
      name: getDisplayName(callerData) || caller.email,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const existingComments = ticket.comments || [];
    await db.collection('help_tickets').doc(ticketId).update({
      comments: [...existingComments, comment],
      updatedAt: new Date().toISOString(),
    });

    // Only notify if the commenter is NOT the ticket creator
    if (caller.uid !== ticket.createdBy) {
      notifyTicketCreator(ticket, 'New Comment', `${comment.name} added a comment`);
    }

    return { success: true, comment };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch help desk group members (for assignment dropdown).
 */
export async function fetchHelpDeskMembers() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const hasAccess = await checkHelpDeskAccess(caller);
  if (!hasAccess) return { success: false, error: 'Permission denied' };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Get help-desk group members
    const memberSnap = await db.collection('group_members')
      .where('groupId', '==', 'help-desk')
      .get();

    const members = [];
    for (const doc of memberSnap.docs) {
      const agentSnap = await db.collection('agents').doc(doc.data().agentId).get();
      if (agentSnap.exists && agentSnap.data().agency_id === caller.agencyId) {
        const agent = agentSnap.data();
        members.push({
          id: agentSnap.id,
          name: getDisplayName(agent) || agent.email,
        });
      }
    }

    // Also include admins/owners/IT
    const adminSnap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    adminSnap.forEach(doc => {
      const data = doc.data();
      if (data.is_owner || data.role === 'admin' || data.role === 'it_engineer') {
        if (!members.find(m => m.id === doc.id)) {
          members.push({
            id: doc.id,
            name: getDisplayName(data) || data.email,
          });
        }
      }
    });

    return { success: true, members };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
