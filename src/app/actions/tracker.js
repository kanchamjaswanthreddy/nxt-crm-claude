'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { validateLengths, validateEmail, validatePhone, FIELD_LIMITS } from '@/lib/validation';

function cleanDoc(data) {
  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof val.toDate === 'function') {
      clean[key] = val.toDate().toISOString();
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/* ── Default stage configs ── */

const DEFAULT_RECRUITING_STAGES = [
  { name: 'New Lead', order: 0, color: '#6B7280' },
  { name: 'First Approach', order: 1, color: '#3B82F6' },
  { name: 'Presentation Scheduled', order: 2, color: '#8B5CF6' },
  { name: 'Presentation Done', order: 3, color: '#A855F7' },
  { name: 'Interested', order: 4, color: '#F59E0B' },
  { name: 'Follow Up', order: 5, color: '#F97316' },
  { name: 'Interviewing', order: 6, color: '#0EA5E9' },
  { name: 'Getting Licensed', order: 7, color: '#14B8A6' },
  { name: 'Licensed', order: 8, color: '#10B981' },
  { name: 'Onboarding', order: 9, color: '#22C55E' },
  { name: 'Hired / Active', order: 10, color: '#16A34A' },
  { name: 'Not Interested', order: 11, color: '#EF4444' },
  { name: 'Lost', order: 12, color: '#9CA3AF' },
];

const DEFAULT_SALES_STAGES = [
  { name: 'New Prospect', order: 0, color: '#6B7280' },
  { name: 'Initial Contact', order: 1, color: '#3B82F6' },
  { name: 'Fact Finding', order: 2, color: '#8B5CF6' },
  { name: 'Presentation Scheduled', order: 3, color: '#A855F7' },
  { name: 'Presentation Done', order: 4, color: '#F59E0B' },
  { name: 'Application Started', order: 5, color: '#F97316' },
  { name: 'Application Submitted', order: 6, color: '#0EA5E9' },
  { name: 'Underwriting', order: 7, color: '#14B8A6' },
  { name: 'Verification', order: 8, color: '#10B981' },
  { name: 'Policy Issued', order: 9, color: '#16A34A' },
  { name: 'Declined by Carrier', order: 10, color: '#EF4444' },
  { name: 'Client Withdrew', order: 11, color: '#9CA3AF' },
];

/* ── Tracker Settings (per agency) ── */

export async function fetchTrackerSettings() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const doc = await db.collection('trackerSettings').doc(caller.agencyId).get();
    if (!doc.exists) {
      // Seed defaults
      const defaults = {
        agencyId: caller.agencyId,
        recruitingStages: DEFAULT_RECRUITING_STAGES,
        salesStages: DEFAULT_SALES_STAGES,
        customFields: [],
        createdAt: new Date().toISOString(),
      };
      await db.collection('trackerSettings').doc(caller.agencyId).set(defaults);
      return { success: true, settings: defaults };
    }
    return { success: true, settings: cleanDoc(doc.data()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateTrackerSettings(updates) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.collection('trackerSettings').doc(caller.agencyId).set(
      { ...updates, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/* ── Contacts CRUD ── */

export async function fetchTrackerContacts() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const isAdmin = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

  try {
    let query = db.collection('trackerContacts')
      .where('agencyId', '==', caller.agencyId)
      .where('createdBy', '==', caller.uid);

    const snap = await query.get();

    const contacts = [];
    snap.forEach(doc => contacts.push({ id: doc.id, ...cleanDoc(doc.data()) }));
    contacts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { success: true, contacts };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createTrackerContact(data) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!data.fullName) return { success: false, error: 'Name is required' };

  const lengthErr = validateLengths([
    [data.fullName, 'Full name', FIELD_LIMITS.name],
    [data.phone, 'Phone', FIELD_LIMITS.phone],
    [data.email, 'Email', FIELD_LIMITS.email],
    [data.city, 'City', FIELD_LIMITS.general],
    [data.state, 'State', FIELD_LIMITS.state],
    [data.notes, 'Notes', FIELD_LIMITS.note],
    [data.policyNumber, 'Policy number', FIELD_LIMITS.policyNumber],
    [data.carrier, 'Carrier', FIELD_LIMITS.general],
    [data.occupation, 'Occupation', FIELD_LIMITS.general],
    [data.source, 'Source', FIELD_LIMITS.general],
    [data.relationshipNotes, 'Relationship notes', FIELD_LIMITS.note],
  ].filter(([v]) => v));
  if (lengthErr) return { success: false, error: lengthErr };

  if (data.email) {
    const emailErr = validateEmail(data.email);
    if (emailErr) return { success: false, error: emailErr };
  }
  if (data.phone) {
    const phoneErr = validatePhone(data.phone);
    if (phoneErr) return { success: false, error: phoneErr };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const now = new Date().toISOString();
    const contact = {
      agencyId: caller.agencyId,
      type: data.type || 'prospect',
      fullName: data.fullName,
      phone: data.phone || '',
      email: data.email || '',
      dateOfBirth: data.dateOfBirth || '',
      city: data.city || '',
      state: data.state || '',
      ethnicity: data.ethnicity || '',
      language: data.language || '',
      occupation: data.occupation || '',
      introducedBy: data.introducedBy || '',
      relationshipNotes: data.relationshipNotes || '',
      familyDetails: data.familyDetails || '',
      position: data.position || '',
      pace: data.pace || '',
      licensedStates: data.licensedStates || '',
      productInterest: data.productInterest || [],
      carrier: data.carrier || '',
      policyAmount: data.policyAmount || '',
      monthlyPremium: data.monthlyPremium || '',
      annualPremium: data.annualPremium || '',
      potentialIncome: data.potentialIncome || '',
      policyNumber: data.policyNumber || '',
      stage: data.stage || '',
      stageType: data.stageType || 'recruiting',
      assignedAgentId: data.assignedAgentId || '',
      assignedAgentName: data.assignedAgentName || '',
      priority: data.priority || 'warm',
      source: data.source || '',
      lastContactedAt: data.lastContactedAt || '',
      nextFollowupAt: data.nextFollowupAt || '',
      notes: data.notes || '',
      customFields: data.customFields || {},
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await db.collection('trackerContacts').add(contact);
    return { success: true, id: ref.id, contact: { id: ref.id, ...contact } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateTrackerContact(contactId, updates) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!contactId) return { success: false, error: 'No contact ID' };
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the contact belongs to the caller's agency
    const contactSnap = await db.collection('trackerContacts').doc(contactId).get();
    if (!contactSnap.exists || contactSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Contact not found.' };
    }

    // Non-admins can only update their own contacts
    const isAdmin = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
    if (!isAdmin && contactSnap.data().createdBy !== caller.uid) {
      return { success: false, error: 'Not authorized to update this contact.' };
    }

    await db.collection('trackerContacts').doc(contactId).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteTrackerContact(contactId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!contactId) return { success: false, error: 'No contact ID' };
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the contact belongs to the caller's agency
    const contactSnap = await db.collection('trackerContacts').doc(contactId).get();
    if (!contactSnap.exists || contactSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Contact not found.' };
    }

    // Non-admins can only delete their own contacts
    const isAdmin = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
    if (!isAdmin && contactSnap.data().createdBy !== caller.uid) {
      return { success: false, error: 'Not authorized to delete this contact.' };
    }

    await db.collection('trackerContacts').doc(contactId).delete();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/* ── Activity Log ── */

export async function addTrackerActivity(contactId, activity) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!contactId) return { success: false, error: 'No contact ID' };

  if (activity?.note) {
    const noteErr = validateLengths([[activity.note, 'Note', FIELD_LIMITS.note]]);
    if (noteErr) return { success: false, error: noteErr };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the contact belongs to the caller's agency
    const contactSnap = await db.collection('trackerContacts').doc(contactId).get();
    if (!contactSnap.exists || contactSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Contact not found.' };
    }

    const now = new Date().toISOString();
    const entry = {
      type: activity.type || 'note',
      note: activity.note || '',
      createdBy: caller.uid,
      createdByName: caller.fullName || '',
      createdAt: now,
    };

    await db.collection('trackerContacts').doc(contactId)
      .collection('activities').add(entry);

    // Also update lastContactedAt on the contact
    if (['called', 'texted', 'emailed', 'met_in_person', 'zoom', 'whatsapp'].includes(activity.type)) {
      await db.collection('trackerContacts').doc(contactId).update({
        lastContactedAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchTrackerActivities(contactId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!contactId) return { success: false, error: 'No contact ID' };
  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the contact belongs to the caller's agency
    const contactSnap = await db.collection('trackerContacts').doc(contactId).get();
    if (!contactSnap.exists || contactSnap.data().agencyId !== caller.agencyId) {
      return { success: false, error: 'Contact not found.' };
    }

    const snap = await db.collection('trackerContacts').doc(contactId)
      .collection('activities')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const activities = [];
    snap.forEach(doc => activities.push({ id: doc.id, ...cleanDoc(doc.data()) }));
    return { success: true, activities };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
