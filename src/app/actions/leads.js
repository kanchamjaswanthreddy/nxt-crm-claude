'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { incrementAgentMetrics } from '@/app/actions/metrics';
import { logActivity } from '@/lib/activityLogger';
import { validateLengths, validateEmail, validatePhone, isRateLimited, FIELD_LIMITS } from '@/lib/validation';

export async function createLead(data) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  // Always use agencyId and creatorAgentId from session — never trust client
  const agencyId = caller.agencyId;
  const creatorAgentId = caller.uid;

  const {
    firstName,
    lastName,
    email,
    phone,
    address = {},
    source = 'manual',
    tags = [],
    recaptchaToken = null
  } = data;

  if (!firstName || !lastName || (!email && !phone)) {
    return { success: false, error: 'Missing required fields. First name, last name, and email or phone are required.' };
  }

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: emailErr };
  const phoneErr = validatePhone(phone);
  if (phoneErr) return { success: false, error: phoneErr };
  const lenErr = validateLengths([
    [firstName, 'First name', FIELD_LIMITS.name],
    [lastName, 'Last name', FIELD_LIMITS.name],
    [email, 'Email', FIELD_LIMITS.email],
    [phone, 'Phone', FIELD_LIMITS.phone],
    [address?.street, 'Street', FIELD_LIMITS.address],
    [address?.city, 'City', FIELD_LIMITS.address],
    [address?.state, 'State', FIELD_LIMITS.state],
    [address?.zip, 'ZIP', FIELD_LIMITS.zip],
  ]);
  if (lenErr) return { success: false, error: lenErr };

  // Rate limit: 50 leads per hour per user
  if (isRateLimited(`lead-create:${caller.uid}`, 50, 3600000)) {
    return { success: false, error: 'Too many leads created. Please try again later.' };
  }

  // Phase 7: Bot Protection
  if (source === 'web_form') {
    if (!recaptchaToken) {
      return { success: false, error: 'Bot verification failed.' };
    }
    // TODO: Actually verify the token against Google reCAPTCHA Enterprise/v3 API here.
    // e.g. const res = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`, { method: 'POST' });
    // if (!res.ok || !res.json().success) throw error...
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      // 1. Check for duplicates
      const dupQuery1 = email ? db.collection('leads').where('agencyId', '==', agencyId).where('email', '==', email).limit(1) : null;
      const dupQuery2 = phone ? db.collection('leads').where('agencyId', '==', agencyId).where('phone', '==', phone).limit(1) : null;

      let duplicateDoc = null;
      if (dupQuery1) {
        const snap = await transaction.get(dupQuery1);
        if (!snap.empty) duplicateDoc = snap.docs[0];
      }
      if (!duplicateDoc && dupQuery2) {
        const snap = await transaction.get(dupQuery2);
        if (!snap.empty) duplicateDoc = snap.docs[0];
      }

      let isFlagged = false;
      let duplicateOfLeadId = null;

      if (duplicateDoc) {
        if (source === 'manual') {
          throw new Error(`DUPLICATE:${duplicateDoc.id}:${duplicateDoc.data().firstName} ${duplicateDoc.data().lastName}`);
        } else if (source === 'web_form' || source === 'csv_import') {
          duplicateOfLeadId = duplicateDoc.id;
        }
      }

      // 2. Determine Assignment
      let ownerAgentId = data.ownerAgentId || null;
      let ownerHierarchyPath = data.ownerHierarchyPath || null;

      if (!ownerAgentId && !duplicateOfLeadId) {
        const agencyRef = db.collection('agencies').doc(agencyId);
        const agencySnap = await transaction.get(agencyRef);

        if (agencySnap.exists) {
          const settings = agencySnap.data().settings || {};
          const mode = settings.leadAssignmentMode || 'manual';

          if (mode === 'round_robin' || mode === 'license_matched_round_robin') {
            let pointer = settings.roundRobinPointer || 0;

            // Get eligible agents
            const agentsRef = db.collection('agents').where('agency_id', '==', agencyId).where('status', 'in', ['active', 'pending_licensing']);
            const agentsSnap = await transaction.get(agentsRef);

            let eligibleAgents = [];
            agentsSnap.forEach(doc => {
              const agentData = doc.data();
              if (mode === 'license_matched_round_robin') {
                const states = agentData.licensedStates || [];
                if (address.state && states.includes(address.state.toUpperCase())) {
                  eligibleAgents.push({ id: doc.id, ...agentData });
                }
              } else {
                eligibleAgents.push({ id: doc.id, ...agentData });
              }
            });

            // Sort consistently by ID for stable round-robin
            eligibleAgents.sort((a, b) => a.id.localeCompare(b.id));

            if (eligibleAgents.length > 0) {
              const selectedAgent = eligibleAgents[pointer % eligibleAgents.length];
              ownerAgentId = selectedAgent.id;
              ownerHierarchyPath = selectedAgent.hierarchyPath;

              // Advance pointer
              transaction.update(agencyRef, {
                'settings.roundRobinPointer': pointer + 1
              });
            } else {
              if (mode === 'license_matched_round_robin') {
                isFlagged = true; // No licensed agent found
              }
            }
          }
        }
      }

      // 3. Create the Lead
      const newLeadRef = db.collection('leads').doc();
      const leadData = {
        agencyId,
        ownerAgentId,
        ownerHierarchyPath,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        dateOfBirth: data.dateOfBirth || null,
        address: {
          street: address.street || '',
          city: address.city || '',
          state: address.state ? address.state.toUpperCase() : '',
          zip: address.zip || ''
        },
        source,
        status: 'new',
        tags,
        duplicateOfLeadId,
        flagged: isFlagged,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastContactedAt: null,
        createdByAgentId: creatorAgentId
      };

      transaction.set(newLeadRef, leadData);

      if (duplicateOfLeadId && source === 'web_form') {
        const noteRef = db.collection('leadNotes').doc();
        transaction.set(noteRef, {
          leadId: duplicateOfLeadId,
          authorAgentId: 'system',
          body: 'Duplicate submission received via web form',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Phase 6: Track Assigned Leads
      if (ownerAgentId) {
        incrementAgentMetrics(transaction, admin, db, agencyId, ownerAgentId, ownerHierarchyPath, {
          leadsAssignedCount: 1
        });
      }

      return { success: true, id: newLeadRef.id, isDuplicate: !!duplicateOfLeadId };
    });

    return result;
  } catch (error) {
    if (error.message.startsWith('DUPLICATE:')) {
      const parts = error.message.split(':');
      return { success: false, isDuplicate: true, duplicateId: parts[1], duplicateName: parts[2] };
    }
    return { success: false, error: error.message };
  }
}

export async function reassignLead(leadId, newOwnerId, newOwnerHierarchyPath) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const leadRef = db.collection('leads').doc(leadId);
      const leadSnap = await transaction.get(leadRef);
      if (!leadSnap.exists) throw new Error("Lead not found");
      const currentLead = leadSnap.data();

      // Verify the lead belongs to caller's agency
      if (currentLead.agencyId !== caller.agencyId) throw new Error("Unauthorized");

      // Only admin or the current owner can reassign
      const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner;
      if (currentLead.ownerAgentId !== caller.uid && !isAdmin) throw new Error("Unauthorized");

      transaction.update(leadRef, {
        ownerAgentId: newOwnerId,
        ownerHierarchyPath: newOwnerHierarchyPath,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Transfer assignment counts
      if (currentLead.ownerAgentId) {
        incrementAgentMetrics(transaction, admin, db, currentLead.agencyId, currentLead.ownerAgentId, currentLead.ownerHierarchyPath, {
          leadsAssignedCount: -1
        });
      }
      incrementAgentMetrics(transaction, admin, db, currentLead.agencyId, newOwnerId, newOwnerHierarchyPath, {
        leadsAssignedCount: 1
      });
    });
    return { success: true };
  } catch (error) {
    if (error.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
    return { success: false, error: error.message };
  }
}

export async function updateLeadStatus(leadId, newStatus) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const leadRef = db.collection('leads').doc(leadId);
      const leadSnap = await transaction.get(leadRef);
      if (!leadSnap.exists) throw new Error("Lead not found");
      const currentLead = leadSnap.data();

      // Verify the lead belongs to caller's agency
      if (currentLead.agencyId !== caller.agencyId) throw new Error("Unauthorized");

      // Only update if status changed
      if (currentLead.status !== newStatus) {
        transaction.update(leadRef, {
          status: newStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Phase 6: Track conversions
        if (newStatus === 'client' && currentLead.ownerAgentId) {
          incrementAgentMetrics(transaction, admin, db, currentLead.agencyId, currentLead.ownerAgentId, currentLead.ownerHierarchyPath, {
            leadsConvertedCount: 1
          });
        } else if (currentLead.status === 'client' && currentLead.ownerAgentId) {
          incrementAgentMetrics(transaction, admin, db, currentLead.agencyId, currentLead.ownerAgentId, currentLead.ownerHierarchyPath, {
            leadsConvertedCount: -1
          });
        }
      }
    });
    return { success: true };
  } catch (error) {
    if (error.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
    return { success: false, error: error.message };
  }
}

export async function addLeadNote(leadId, body) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  const lenErr = validateLengths([
    [body, 'Note', FIELD_LIMITS.note],
  ]);
  if (lenErr) return { success: false, error: lenErr };

  try {
    // Verify the lead belongs to caller's agency
    const leadSnap = await db.collection('leads').doc(leadId).get();
    if (!leadSnap.exists) return { success: false, error: 'Lead not found.' };
    if (leadSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    const noteRef = db.collection('leadNotes').doc();
    await noteRef.set({
      leadId,
      authorAgentId: caller.uid,
      body,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, id: noteRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function exportContactData(leadId) {
  let caller;
  try {
    caller = await requireAdmin();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  // M-21: Firestore-based rate limit — max 5 exports per hour per user
  try {
    const rlRef = db.collection('rate_limits').doc(`export_${caller.uid}`);
    const rlSnap = await rlRef.get();
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    if (rlSnap.exists) {
      const rlData = rlSnap.data();
      const windowStart = rlData.windowStart || 0;
      const count = rlData.count || 0;

      if (now - windowStart < oneHourMs) {
        if (count >= 5) {
          return { success: false, error: 'Export rate limit reached. Maximum 5 exports per hour.' };
        }
        await rlRef.update({ count: count + 1 });
      } else {
        await rlRef.set({ count: 1, windowStart: now });
      }
    } else {
      await rlRef.set({ count: 1, windowStart: now });
    }
  } catch (rlErr) {
  }

  try {
    const leadDoc = await db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) throw new Error("Lead not found");

    const lead = { id: leadDoc.id, ...leadDoc.data() };

    // Verify the lead belongs to caller's agency
    if (lead.agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    // Notes
    const notesSnap = await db.collection('leadNotes').where('leadId', '==', leadId).get();
    const notes = [];
    notesSnap.forEach(n => notes.push({ id: n.id, ...n.data() }));

    // Deals
    const dealsSnap = await db.collection('deals').where('leadId', '==', leadId).get();
    const deals = [];
    dealsSnap.forEach(d => deals.push({ id: d.id, ...d.data() }));

    // Tasks
    const tasksSnap = await db.collection('tasks').where('relatedLeadId', '==', leadId).get();
    const tasks = [];
    tasksSnap.forEach(t => tasks.push({ id: t.id, ...t.data() }));

    const payload = { lead, notes, deals, tasks };
    return { success: true, payload: JSON.stringify(payload, null, 2) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function anonymizeContact(leadId) {
  let caller;
  try {
    caller = await requireAdmin();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const leadDoc = await db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) throw new Error("Lead not found");
    const lead = leadDoc.data();

    // Verify the lead belongs to caller's agency
    if (lead.agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    await db.collection('leads').doc(leadId).update({
      firstName: 'ANONYMIZED',
      lastName: 'CONTACT',
      email: null,
      phone: null,
      address: {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log in AuditLog
    await db.collection('AuditLog').add({
      agencyId: lead.agencyId,
      actorAgentId: caller.uid,
      action: 'ANONYMIZE_CONTACT',
      targetType: 'Lead',
      targetId: leadId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // M-08: Audit trail via activityLogger
    logActivity({
      category: 'admin',
      action: 'anonymize_contact',
      actorId: caller.uid,
      description: `Anonymized contact ${leadId}`,
      targetId: leadId,
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateLeadFields(leadId, fields) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  const { firstName, lastName, email, phone, address } = fields;
  if (!firstName || !lastName) {
    return { success: false, error: 'First name and last name are required.' };
  }
  if (!email && !phone) {
    return { success: false, error: 'At least one of email or phone is required.' };
  }

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: emailErr };
  const phoneErr = validatePhone(phone);
  if (phoneErr) return { success: false, error: phoneErr };
  const lenErr = validateLengths([
    [firstName, 'First name', FIELD_LIMITS.name],
    [lastName, 'Last name', FIELD_LIMITS.name],
    [email, 'Email', FIELD_LIMITS.email],
    [phone, 'Phone', FIELD_LIMITS.phone],
    [address?.street, 'Street', FIELD_LIMITS.address],
    [address?.city, 'City', FIELD_LIMITS.address],
    [address?.state, 'State', FIELD_LIMITS.state],
    [address?.zip, 'ZIP', FIELD_LIMITS.zip],
  ]);
  if (lenErr) return { success: false, error: lenErr };

  try {
    // Verify the lead belongs to caller's agency
    const leadSnap = await db.collection('leads').doc(leadId).get();
    if (!leadSnap.exists) return { success: false, error: 'Lead not found.' };
    if (leadSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    await db.collection('leads').doc(leadId).update({
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function assignLead(leadId, agentId, agentHierarchyPath) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the lead belongs to caller's agency
    const leadSnap = await db.collection('leads').doc(leadId).get();
    if (!leadSnap.exists) return { success: false, error: 'Lead not found.' };
    const leadData = leadSnap.data();
    if (leadData.agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    // Only admin or the current owner can assign
    const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner;
    if (leadData.ownerAgentId !== caller.uid && !isAdmin) return { success: false, error: 'Unauthorized' };

    // M-28: Verify target agent exists in Firestore before assigning
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) return { success: false, error: 'Target agent not found' };

    await db.collection('leads').doc(leadId).update({
      ownerAgentId: agentId,
      ownerHierarchyPath: agentHierarchyPath,
      flagged: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function importLeads(rows) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const agencyId = caller.agencyId;
  const creatorAgentId = caller.uid;

  // Rate limit: 5 imports per hour per user
  if (isRateLimited(`lead-import:${caller.uid}`, 5, 3600000)) {
    return { success: false, error: 'Too many imports. Please try again later.' };
  }

  const results = {
    imported: 0,
    skipped: 0,
    flaggedAsDuplicate: 0,
    errors: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Validate
      if (!row.firstName || !row.lastName || (!row.email && !row.phone)) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: Missing required fields`);
        continue;
      }

      const rowEmailErr = validateEmail(row.email);
      if (rowEmailErr) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: ${rowEmailErr}`);
        continue;
      }
      const rowPhoneErr = validatePhone(row.phone);
      if (rowPhoneErr) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: ${rowPhoneErr}`);
        continue;
      }
      const rowLenErr = validateLengths([
        [row.firstName, 'First name', FIELD_LIMITS.name],
        [row.lastName, 'Last name', FIELD_LIMITS.name],
        [row.email, 'Email', FIELD_LIMITS.email],
        [row.phone, 'Phone', FIELD_LIMITS.phone],
      ]);
      if (rowLenErr) {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: ${rowLenErr}`);
        continue;
      }

      const res = await createLead({
        agencyId,
        creatorAgentId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        address: {
          street: row.street || '',
          city: row.city || '',
          state: row.state || '',
          zip: row.zip || ''
        },
        source: 'csv_import'
      });

      if (res.success) {
        if (res.isDuplicate) {
          results.flaggedAsDuplicate++;
        } else {
          results.imported++;
        }
      } else {
        results.skipped++;
        results.errors.push(`Row ${i + 1}: ${res.error || 'Failed to create'}`);
      }
    } catch (error) {
      results.skipped++;
      results.errors.push(`Row ${i + 1}: ${error.message}`);
    }
  }

  return { success: true, results };
}

export async function fetchLeads(hierarchyPath) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    let query = db.collection('leads').where('agencyId', '==', caller.agencyId);

    // If admin or manager, they can see unassigned leads.
    // We'll just fetch all for the agency, then filter in memory for simplicity
    // since 'OR' queries are complex in Firestore and we need hierarchy prefix matching.
    const snapshot = await query.get();
    let leads = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      // Apply visibility rules
      let canSee = false;

      if (data.ownerAgentId === caller.uid) {
        canSee = true;
      } else if (data.ownerHierarchyPath && hierarchyPath && data.ownerHierarchyPath.startsWith(hierarchyPath + '/')) {
        canSee = true;
      } else if (!data.ownerAgentId && (caller.role === 'admin' || caller.role === 'it_engineer')) {
        canSee = true;
      }

      if (canSee) {
        leads.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
          lastContactedAt: data.lastContactedAt ? data.lastContactedAt.toDate().toISOString() : null
        });
      }
    });

    // Sort newest first
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { success: true, leads };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Bulk update status for multiple leads.
 */
export async function bulkUpdateLeadStatus(leadIds, newStatus) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!Array.isArray(leadIds) || leadIds.length === 0) return { success: false, error: 'No leads selected' };
  if (leadIds.length > 100) return { success: false, error: 'Maximum 100 leads per bulk action' };

  const admin = getAdminApp();
  const db = admin.firestore();
  const batch = db.batch();
  let updated = 0;

  try {
    for (const id of leadIds) {
      const ref = db.collection('leads').doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data();
      if (data.agencyId !== caller.agencyId) continue;
      batch.update(ref, { status: newStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      updated++;
    }
    await batch.commit();
    return { success: true, updated };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Bulk delete leads (soft or hard — here we do hard delete).
 */
export async function bulkDeleteLeads(leadIds) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!Array.isArray(leadIds) || leadIds.length === 0) return { success: false, error: 'No leads selected' };
  if (leadIds.length > 100) return { success: false, error: 'Maximum 100 leads per bulk action' };

  const admin = getAdminApp();
  const db = admin.firestore();
  const batch = db.batch();
  let deleted = 0;

  try {
    for (const id of leadIds) {
      const ref = db.collection('leads').doc(id);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const data = snap.data();
      if (data.agencyId !== caller.agencyId) continue;
      batch.delete(ref);
      deleted++;
    }
    await batch.commit();
    return { success: true, deleted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
