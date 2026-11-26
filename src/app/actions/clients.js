'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { validateLengths, validateEmail, validatePhone, validateSSN4, isRateLimited, FIELD_LIMITS } from '@/lib/validation';

export async function createClient(data) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

  const {
    agentHierarchyPath,
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    gender,
    maritalStatus,
    ssn4,
    employer,
    occupation,
    annualIncome,
    address,
    preferredContact,
    tags,
  } = data;

  if (!firstName || !lastName) {
    return { success: false, error: 'First and last name are required.' };
  }
  if (!email && !phone) {
    return { success: false, error: 'Either email or phone is required.' };
  }

  const emailErr = validateEmail(email);
  if (emailErr) return { success: false, error: emailErr };
  const phoneErr = validatePhone(phone);
  if (phoneErr) return { success: false, error: phoneErr };
  const ssn4Err = validateSSN4(ssn4);
  if (ssn4Err) return { success: false, error: ssn4Err };
  const lenErr = validateLengths([
    [firstName, 'First name', FIELD_LIMITS.name],
    [lastName, 'Last name', FIELD_LIMITS.name],
    [employer, 'Employer', FIELD_LIMITS.general],
    [occupation, 'Occupation', FIELD_LIMITS.general],
    [address?.street, 'Street', FIELD_LIMITS.address],
    [address?.city, 'City', FIELD_LIMITS.address],
    [address?.state, 'State', FIELD_LIMITS.state],
    [address?.zip, 'ZIP', FIELD_LIMITS.zip],
  ]);
  if (lenErr) return { success: false, error: lenErr };

  // Rate limit: 50 clients per hour per user
  if (isRateLimited(`client-create:${caller.uid}`, 50, 3600000)) {
    return { success: false, error: 'Too many clients created. Please try again later.' };
  }

  // Always use agencyId and agentId from the session — never trust client
  const agencyId = caller.agencyId;
  const agentId = caller.uid;

  try {
    // Check for duplicates
    if (email) {
      const emailSnap = await db.collection('clients')
        .where('agencyId', '==', agencyId)
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!emailSnap.empty) {
        const dup = emailSnap.docs[0];
        return {
          success: false,
          isDuplicate: true,
          duplicateId: dup.id,
          duplicateName: `${dup.data().firstName} ${dup.data().lastName}`,
          error: 'A client with this email already exists.',
        };
      }
    }

    const ref = db.collection('clients').doc();
    await ref.set({
      agencyId,
      agentId,
      agentHierarchyPath: agentHierarchyPath || null,
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      maritalStatus: maritalStatus || null,
      ssn4: ssn4 || null,
      employer: employer || null,
      occupation: occupation || null,
      annualIncome: annualIncome ? Number(annualIncome) : null,
      address: address || {},
      preferredContact: preferredContact || 'email',
      tags: tags || [],
      policyCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchClients(hierarchyPath) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('clients')
      .where('agencyId', '==', caller.agencyId)
      .orderBy('createdAt', 'desc')
      .get();

    const clients = [];
    snap.forEach((doc) => {
      const data = doc.data();
      // Visibility: agent sees own clients, admin/it sees all
      const isOwner = data.agentId === caller.uid;
      const isUnderHierarchy = hierarchyPath && data.agentHierarchyPath?.startsWith(hierarchyPath + '/');
      const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer';

      if (isOwner || isUnderHierarchy || isAdmin) {
        clients.push({
          id: doc.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          policyCount: data.policyCount || 0,
          tags: data.tags || [],
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        });
      }
    });

    return { success: true, clients };
  } catch (error) {
    return { success: false, error: error.message, clients: [] };
  }
}

export async function getClient(clientId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const docSnap = await db.collection('clients').doc(clientId).get();
    if (!docSnap.exists) {
      return { success: false, error: 'Client not found.' };
    }

    const data = docSnap.data();

    // Verify the client belongs to caller's agency
    if (data.agencyId !== caller.agencyId) {
      return { success: false, error: 'Unauthorized' };
    }

    return {
      success: true,
      client: {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateClient(clientId, updates) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const lenErr = validateLengths([
    [updates.firstName, 'First name', FIELD_LIMITS.name],
    [updates.lastName, 'Last name', FIELD_LIMITS.name],
    [updates.employer, 'Employer', FIELD_LIMITS.general],
    [updates.occupation, 'Occupation', FIELD_LIMITS.general],
    [updates.address?.street, 'Street', FIELD_LIMITS.address],
    [updates.address?.city, 'City', FIELD_LIMITS.address],
    [updates.address?.state, 'State', FIELD_LIMITS.state],
    [updates.address?.zip, 'ZIP', FIELD_LIMITS.zip],
  ]);
  if (lenErr) return { success: false, error: lenErr };
  const emailErr = validateEmail(updates.email);
  if (emailErr) return { success: false, error: emailErr };
  const phoneErr = validatePhone(updates.phone);
  if (phoneErr) return { success: false, error: phoneErr };
  const ssn4Err = validateSSN4(updates.ssn4);
  if (ssn4Err) return { success: false, error: ssn4Err };

  const admin = getAdminApp();
  const db = admin.firestore();
  const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

  try {
    // Verify the client belongs to caller's agency
    const docSnap = await db.collection('clients').doc(clientId).get();
    if (!docSnap.exists) return { success: false, error: 'Client not found.' };
    if (docSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    await db.collection('clients').doc(clientId).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function addPolicy(clientId, policyData) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

  // Verify the client belongs to caller's agency
  try {
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: 'Client not found.' };
    if (clientSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };
  } catch (error) {
    return { success: false, error: error.message };
  }

  const {
    carrier,
    policyNumber,
    type,
    status,
    premium,
    premiumFrequency,
    coverageAmount,
    effectiveDate,
    expiryDate,
    beneficiaries,
    notes,
  } = policyData;

  if (!carrier || !policyNumber || !type) {
    return { success: false, error: 'Carrier, policy number, and type are required.' };
  }

  const lenErr = validateLengths([
    [carrier, 'Carrier', FIELD_LIMITS.general],
    [policyNumber, 'Policy number', FIELD_LIMITS.policyNumber],
    [type, 'Type', FIELD_LIMITS.general],
  ]);
  if (lenErr) return { success: false, error: lenErr };

  try {
    const ref = db.collection('clients').doc(clientId).collection('policies').doc();
    await ref.set({
      carrier,
      policyNumber,
      type,
      status: status || 'active',
      premium: premium ? Number(premium) : null,
      premiumFrequency: premiumFrequency || 'monthly',
      coverageAmount: coverageAmount ? Number(coverageAmount) : null,
      effectiveDate: effectiveDate || null,
      expiryDate: expiryDate || null,
      beneficiaries: beneficiaries || [],
      notes: notes || '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Increment policy count on client
    await db.collection('clients').doc(clientId).update({
      policyCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchPolicies(clientId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the client belongs to caller's agency
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: 'Client not found.', policies: [] };
    if (clientSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized', policies: [] };

    const snap = await db.collection('clients').doc(clientId)
      .collection('policies')
      .orderBy('createdAt', 'desc')
      .get();

    const policies = [];
    snap.forEach((doc) => {
      const data = doc.data();
      policies.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      });
    });

    return { success: true, policies };
  } catch (error) {
    return { success: false, error: error.message, policies: [] };
  }
}

export async function updatePolicy(clientId, policyId, updates) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

  try {
    // Verify the client belongs to caller's agency
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: 'Client not found.' };
    if (clientSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    await db.collection('clients').doc(clientId)
      .collection('policies').doc(policyId)
      .update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deletePolicy(clientId, policyId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

  try {
    // Verify the client belongs to caller's agency
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: 'Client not found.' };
    if (clientSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    await db.collection('clients').doc(clientId)
      .collection('policies').doc(policyId)
      .delete();

    await db.collection('clients').doc(clientId).update({
      policyCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function addClientNote(clientId, body) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

  if (!body?.trim()) {
    return { success: false, error: 'Note body is required.' };
  }

  const lenErr = validateLengths([
    [body, 'Note body', FIELD_LIMITS.note],
  ]);
  if (lenErr) return { success: false, error: lenErr };

  try {
    // Verify the client belongs to caller's agency
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: 'Client not found.' };
    if (clientSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    const ref = db.collection('clients').doc(clientId)
      .collection('clientNotes').doc();
    await ref.set({
      clientId,
      authorAgentId: caller.uid,
      body: body.trim(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchClientNotes(clientId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the client belongs to caller's agency
    const clientSnap = await db.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return { success: false, error: 'Client not found.', notes: [] };
    if (clientSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized', notes: [] };

    const snap = await db.collection('clients').doc(clientId)
      .collection('clientNotes')
      .orderBy('createdAt', 'desc')
      .get();

    const notes = [];
    snap.forEach((doc) => {
      const data = doc.data();
      notes.push({
        id: doc.id,
        clientId: data.clientId,
        authorAgentId: data.authorAgentId,
        body: data.body,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      });
    });

    return { success: true, notes };
  } catch (error) {
    return { success: false, error: error.message, notes: [] };
  }
}
