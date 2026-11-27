'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin, requireApprover, isInSubtree, isTeamLeader } from '@/lib/serverAuth';
import { computeDocChecklist } from '@/lib/documentTypes';
import { getDisplayName } from '@/lib/constants';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

/**
 * Generate a short-lived signed upload URL for the agent to PUT their file.
 * If targetAgentId is provided, an admin/owner can upload on behalf of that agent.
 */
export async function getUploadUrl({ docType, fileName, contentType, size, targetAgentId }) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // If uploading on behalf of another agent, verify admin privileges
    const agentId = targetAgentId || caller.uid;
    if (targetAgentId && targetAgentId !== caller.uid) {
      const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
      // Verify target agent exists in same agency
      const targetSnap = await db.collection('agents').doc(targetAgentId).get();
      if (!targetSnap.exists || targetSnap.data().agency_id !== caller.agencyId) {
        return { success: false, error: 'Target agent not found.' };
      }
      // Admins may upload for anyone; a team leader may upload for people in their own downline.
      if (!isPrivileged) {
        const leaderOk = (await isTeamLeader(caller.uid, caller.agencyId)) && isInSubtree(targetSnap.data().hierarchyPath, caller.uid);
        if (!leaderOk) {
          return { success: false, error: 'Only admins, or a team leader for their own downline, can upload documents for another agent.' };
        }
      }
    }

    // Validate content type
    if (!ALLOWED_TYPES.includes(contentType)) {
      return { success: false, error: 'File type not allowed. Only PDF, JPG, and PNG are accepted.' };
    }

    // Validate extension
    const ext = '.' + (fileName.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { success: false, error: 'File extension not allowed. Only .pdf, .jpg, .jpeg, .png are accepted.' };
    }

    // Validate size
    if (!size || size > MAX_FILE_SIZE) {
      return { success: false, error: 'File too large. Maximum 10 MB.' };
    }
    if (size < 1) {
      return { success: false, error: 'File is empty.' };
    }

    // Validate docType is not empty
    if (!docType || typeof docType !== 'string') {
      return { success: false, error: 'Document type is required.' };
    }

    const safeName = sanitizeName(fileName);
    const timestamp = Date.now();
    const storagePath = `agents/${agentId}/documents/${docType}/${timestamp}-${safeName}`;

    const bucket = admin.storage();
    const file = bucket.file(storagePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      contentType,
    });

    return { success: true, uploadUrl: signedUrl, storagePath };
  } catch (error) {
    return { success: false, error: 'Failed to generate upload URL.' };
  }
}

/**
 * After the client PUTs the file, call this to verify it exists and write the Firestore record.
 * If targetAgentId is provided, an admin/owner can finalize on behalf of that agent.
 */
export async function finalizeDocumentUpload({ docType, storagePath, fileName, size, targetAgentId }) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentId = targetAgentId || caller.uid;

    // If uploading on behalf of another agent, verify admin privileges
    if (targetAgentId && targetAgentId !== caller.uid) {
      const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
      if (!isPrivileged) {
        const targetSnap = await db.collection('agents').doc(targetAgentId).get();
        const leaderOk = targetSnap.exists && targetSnap.data().agency_id === caller.agencyId
          && (await isTeamLeader(caller.uid, caller.agencyId)) && isInSubtree(targetSnap.data().hierarchyPath, caller.uid);
        if (!leaderOk) {
          return { success: false, error: 'Only admins, or a team leader for their own downline, can upload documents for another agent.' };
        }
      }
    }

    const agentSnap = await db.collection('agents').doc(agentId).get();
    if (!agentSnap.exists) return { success: false, error: 'Agent not found.' };

    const agentData = agentSnap.data();
    const bucket = admin.storage();
    const file = bucket.file(storagePath);

    // Verify the object was actually uploaded
    const [exists] = await file.exists();
    if (!exists) {
      return { success: false, error: 'File not found in storage. Upload may have failed.' };
    }

    // Check if there's an existing doc for this type (for onboarding re-uploads)
    const existingSnap = await db.collection('agentDocuments')
      .where('agentId', '==', agentId)
      .where('docType', '==', docType)
      .limit(1)
      .get();

    let docId;
    const now = new Date().toISOString();

    if (!existingSnap.empty) {
      // Update existing record
      docId = existingSnap.docs[0].id;
      await db.collection('agentDocuments').doc(docId).update({
        fileName,
        fileSize: size || null,
        storagePath,
        status: 'pending_review',
        uploadedAt: now,
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        uploadedBy: caller.uid !== agentId ? caller.uid : null,
      });
    } else {
      // Create new record
      const ref = await db.collection('agentDocuments').add({
        agentId,
        agencyId: agentData.agency_id,
        docType,
        fileName,
        fileSize: size || null,
        storagePath,
        status: 'pending_review',
        uploadedAt: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        uploadedBy: caller.uid !== agentId ? caller.uid : null,
      });
      docId = ref.id;
    }

    // Update onboarding progress
    await db.collection('agents').doc(agentId).update({
      'onboardingProgress.documentsUploaded': true,
    });

    return {
      success: true,
      documentId: docId,
      record: {
        id: docId,
        agentId,
        agencyId: agentData.agency_id,
        docType,
        fileName,
        storagePath,
        status: 'pending_review',
        uploadedAt: now,
      },
    };
  } catch (error) {
    return { success: false, error: 'Failed to save document record.' };
  }
}

/**
 * Get a short-lived signed read URL for viewing/downloading a document.
 */
export async function getDocumentViewUrl(documentId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const docSnap = await db.collection('agentDocuments').doc(documentId).get();
    if (!docSnap.exists) return { success: false, error: 'Document not found.' };

    const docData = docSnap.data();

    // Check access: own doc, admin/IT in same agency, or team leader for subtree
    const isDocOwner = docData.agentId === caller.uid;
    const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
    const sameAgency = caller.agencyId === docData.agencyId;

    if (!isDocOwner && !(isPrivileged && sameAgency)) {
      // Check if team leader for this agent's subtree
      const { isTeamLeader: checkTeamLeader } = await import('@/lib/serverAuth');
      const isLeader = await checkTeamLeader(caller.uid, caller.agencyId);
      if (isLeader && sameAgency) {
        const agentSnap = await db.collection('agents').doc(docData.agentId).get();
        if (!agentSnap.exists || !isInSubtree(agentSnap.data().hierarchyPath, caller.uid)) {
          return { success: false, error: 'You do not have permission to view this document.' };
        }
      } else {
        return { success: false, error: 'You do not have permission to view this document.' };
      }
    }

    // Handle legacy docs that have fileURL/storageUrl but no storagePath
    let storagePath = docData.storagePath;
    if (!storagePath) {
      // Try to extract path from legacy download URL
      const legacyUrl = docData.fileURL || docData.storageUrl;
      if (legacyUrl) {
        return { success: true, viewUrl: legacyUrl, isLegacy: true };
      }
      return { success: false, error: 'Document file path not found.' };
    }

    const bucket = admin.storage();
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (!exists) return { success: false, error: 'File no longer exists in storage.' };

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return { success: true, viewUrl: signedUrl };
  } catch (error) {
    return { success: false, error: 'Failed to generate view URL.' };
  }
}

/**
 * Fetch all documents for the authenticated user.
 */
export async function fetchDocuments() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agentDocuments').where('agentId', '==', caller.uid).get();
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      docs.push({
        id: d.id,
        agentId: data.agentId,
        agencyId: data.agencyId,
        docType: data.docType,
        fileName: data.fileName,
        fileSize: data.fileSize || null,
        storagePath: data.storagePath || null,
        status: data.status,
        uploadedAt: data.uploadedAt || (data.createdAt?.toDate?.()?.toISOString()) || null,
        rejectionReason: data.rejectionReason || null,
        reviewedBy: data.reviewedBy || null,
      });
    });

    return { success: true, documents: docs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch documents for a specific agent (admin view).
 */
export async function fetchAgentDocumentsAdmin(agentId) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const isOwn = caller.uid === agentId;
    const isPrivileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

    // Verify agent is in same agency, and that the caller may see them:
    // admins see anyone; a team leader sees people in their own downline.
    if (!isOwn) {
      const agentSnap = await db.collection('agents').doc(agentId).get();
      if (!agentSnap.exists || agentSnap.data().agency_id !== caller.agencyId) {
        return { success: false, error: 'Agent not found.' };
      }
      if (!isPrivileged) {
        const leaderOk = (await isTeamLeader(caller.uid, caller.agencyId)) && isInSubtree(agentSnap.data().hierarchyPath, caller.uid);
        if (!leaderOk) return { success: false, error: 'Permission denied.' };
      }
    }

    const snap = await db.collection('agentDocuments').where('agentId', '==', agentId).get();
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      docs.push({
        id: d.id,
        agentId: data.agentId,
        agencyId: data.agencyId,
        docType: data.docType,
        fileName: data.fileName,
        fileSize: data.fileSize || null,
        storagePath: data.storagePath || null,
        status: data.status,
        uploadedAt: data.uploadedAt || (data.createdAt?.toDate?.()?.toISOString()) || null,
        rejectionReason: data.rejectionReason || null,
        reviewedBy: data.reviewedBy || null,
      });
    });

    return { success: true, documents: docs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch ALL documents across ALL agents in an agency (admin centralized view).
 * Returns documents joined with agent name/nxt_id for display.
 */
export async function fetchAllAgencyDocuments() {
  let caller;
  try { caller = await requireApprover(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Fetch all documents for the agency
    const docsSnap = await db.collection('agentDocuments')
      .where('agencyId', '==', caller.agencyId)
      .get();

    if (docsSnap.empty) return { success: true, documents: [] };

    // Collect unique agent IDs to batch-fetch names and hierarchy paths
    const agentIds = new Set();
    docsSnap.forEach(d => agentIds.add(d.data().agentId));

    // Fetch agent profiles for names (and hierarchyPath for team leader filtering)
    const agentMap = {};
    const idArray = Array.from(agentIds);
    for (const aid of idArray) {
      const agentSnap = await db.collection('agents').doc(aid).get();
      if (agentSnap.exists) {
        const ad = agentSnap.data();
        agentMap[aid] = {
          name: getDisplayName(ad) || ad.preferred_name || ad.email || 'Unknown',
          nxtId: ad.nxt_id || null,
          email: ad.email || null,
          hierarchyPath: ad.hierarchyPath || null,
        };
      }
    }

    const documents = [];
    docsSnap.forEach(d => {
      const data = d.data();
      const agent = agentMap[data.agentId] || { name: 'Unknown', nxtId: null, email: null, hierarchyPath: null };

      // Team leaders only see documents from agents in their subtree
      if (caller.isTeamLeaderOnly && !isInSubtree(agent.hierarchyPath, caller.uid)) {
        return;
      }

      documents.push({
        id: d.id,
        agentId: data.agentId,
        agentName: agent.name,
        agentNxtId: agent.nxtId,
        agentEmail: agent.email,
        docType: data.docType,
        fileName: data.fileName,
        fileSize: data.fileSize || null,
        storagePath: data.storagePath || null,
        status: data.status,
        uploadedAt: data.uploadedAt || (data.createdAt?.toDate?.()?.toISOString()) || null,
        rejectionReason: data.rejectionReason || null,
        reviewedBy: data.reviewedBy || null,
        reviewedAt: data.reviewedAt?.toDate?.()?.toISOString() || null,
      });
    });

    // Sort: pending_review first, then by upload date descending
    documents.sort((a, b) => {
      const statusOrder = { pending_review: 0, rejected: 1, approved: 2 };
      const sa = statusOrder[a.status] ?? 3;
      const sb = statusOrder[b.status] ?? 3;
      if (sa !== sb) return sa - sb;
      return (b.uploadedAt || '').localeCompare(a.uploadedAt || '');
    });

    return { success: true, documents };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch W-9 status for all agents in an agency (admin use).
 * Returns a map of agentId → { hasW9, status }.
 */
export async function fetchAgencyW9Status() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agentDocuments')
      .where('agencyId', '==', caller.agencyId)
      .where('docType', '==', 'w9')
      .get();

    const w9Map = {};
    snap.forEach(d => {
      const data = d.data();
      w9Map[data.agentId] = { hasW9: true, status: data.status };
    });

    return { success: true, w9Map };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


/**
 * Onboarding status for the people the caller looks after: everyone for owners, admins and IT;
 * the caller's own downline for team leaders. One row per person with their document checklist.
 */
export async function fetchTeamOnboarding() {
  let caller;
  try { caller = await requireApprover(); } catch { return { success: false, error: 'Unauthorized' }; }
  const db = getAdminApp().firestore();
  try {
    const [agentSnap, docSnap] = await Promise.all([
      db.collection('agents').where('agency_id', '==', caller.agencyId).get(),
      db.collection('agentDocuments').where('agencyId', '==', caller.agencyId).get(),
    ]);
    const docsByAgent = {};
    docSnap.forEach(d => { const x = d.data(); (docsByAgent[x.agentId] = docsByAgent[x.agentId] || []).push({ docType: x.docType, status: x.status }); });
    const names = {};
    agentSnap.forEach(d => { names[d.id] = getDisplayName(d.data()) || d.data().email || 'Unknown'; });

    const people = [];
    agentSnap.forEach(d => {
      const a = d.data();
      if (a.is_owner || ['admin', 'it_engineer'].includes(a.role)) return;          // not onboarded through documents
      if (caller.isTeamLeaderOnly && !isInSubtree(a.hierarchyPath, caller.uid)) return;
      const list = computeDocChecklist(a, docsByAgent[d.id] || []);
      people.push({
        id: d.id,
        name: names[d.id],
        email: a.email || '',
        status: a.status || 'unknown',
        level: a.contractLevel || '',
        uplineName: a.upline_id ? (names[a.upline_id] || '') : '',
        hasCard: !!a.payment?.cardLastFour,
        cardExempt: !!a.billingExempt,
        hasNpn: !!a.npn,
        total: list.total, uploaded: list.uploaded, approved: list.approved, toUpload: list.toUpload, complete: list.complete,
        items: list.items.map(i => ({ key: i.key, label: i.label, status: i.status, uploadType: i.uploadType })),
      });
    });
    people.sort((x, y) => (x.complete ? 1 : 0) - (y.complete ? 1 : 0) || y.toUpload - x.toUpload || x.name.localeCompare(y.name));
    return { success: true, people, scope: caller.isTeamLeaderOnly ? 'downline' : 'agency' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
