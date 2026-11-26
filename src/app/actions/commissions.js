'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { logActivity } from '@/lib/activityLogger';
import { getDisplayName } from '@/lib/constants';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';
import { incrementAgentMetrics } from '@/app/actions/metrics';

export async function fetchCarriers() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('carriers')
      .where('agencyId', '==', caller.agencyId)
      .get();

    let carriers = [];
    snap.forEach(doc => {
      const data = doc.data();
      carriers.push({
        id: doc.id,
        name: data.name,
        active: data.active,
        notes: data.notes || null,
        agencyId: data.agencyId,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      });
    });
    return { success: true, carriers };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchCommissionRates() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('commissionRates')
      .where('agencyId', '==', caller.agencyId)
      .get();

    let rates = [];
    snap.forEach(doc => {
      rates.push({ id: doc.id, ...doc.data() });
    });
    return { success: true, rates };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createOrUpdateCarrier(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const lengthErr = validateLengths([
    [data.name, 'Carrier name', FIELD_LIMITS.name],
    [data.notes, 'Notes', FIELD_LIMITS.note],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  try {
    let ref;
    const carrierData = {
      agencyId: caller.agencyId,
      name: data.name,
      notes: data.notes || null,
      active: data.active,
    };

    if (data.id) {
      ref = db.collection('carriers').doc(data.id);
      await ref.update(carrierData);
    } else {
      ref = db.collection('carriers').doc();
      carrierData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await ref.set(carrierData);
    }

    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createOrUpdateRate(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  const policyErr = validateLengths([[data.policyType, 'Policy type', FIELD_LIMITS.general]]);
  if (policyErr) return { success: false, error: policyErr };

  // M-09: Validate commission rate is a number between 0 and 100 (inclusive)
  const rateValue = Number(data.commissionPercent);
  if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
    return { success: false, error: 'Commission rate must be a number between 0 and 100.' };
  }

  try {
    let ref;
    const rateData = {
      agencyId: caller.agencyId,
      carrierId: data.carrierId,
      policyType: data.policyType,
      agentLevel: data.agentLevel,
      commissionPercent: rateValue,
      effectiveDate: data.effectiveDate,
    };

    if (data.id) {
      ref = db.collection('commissionRates').doc(data.id);
      await ref.update(rateData);
    } else {
      ref = db.collection('commissionRates').doc();
      rateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await ref.set(rateData);
    }

    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchCommissions(hierarchyPath, viewType = 'my') {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    let query = db.collection('commissions').where('agencyId', '==', caller.agencyId);
    if (viewType === 'my') {
      query = query.where('agentId', '==', caller.uid);
    }
    // L-13: Limit results to avoid unbounded fetches
    query = query.limit(100);
    const snap = await query.get();

    let commissions = [];
    snap.forEach(doc => {
      const data = doc.data();
      let canSee = false;
      if (data.agentId === caller.uid) {
        canSee = true;
      } else if (viewType === 'team' && data.agentHierarchyPath && data.agentHierarchyPath.startsWith(hierarchyPath + '/')) {
        canSee = true;
      } else if (viewType === 'admin') {
        canSee = true; // Assuming admin call
      }

      if (canSee) {
        commissions.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        });
      }
    });

    return { success: true, commissions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function fetchCommissionOverrides(hierarchyPath, viewType = 'my') {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    let query = db.collection('commissionOverrides').where('agencyId', '==', caller.agencyId);
    if (viewType === 'my') {
      query = query.where('beneficiaryAgentId', '==', caller.uid);
    }
    const snap = await query.get();

    let overrides = [];
    snap.forEach(doc => {
      const data = doc.data();
      let canSee = false;
      if (data.beneficiaryAgentId === caller.uid) {
        canSee = true;
      } else if (viewType === 'team' && data.beneficiaryHierarchyPath && data.beneficiaryHierarchyPath.startsWith(hierarchyPath + '/')) {
        canSee = true;
      } else if (viewType === 'admin') {
        canSee = true;
      }

      if (canSee) {
        overrides.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
        });
      }
    });

    return { success: true, overrides };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


export async function fetchNeedsReviewCommissions() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('commissions')
      .where('agencyId', '==', caller.agencyId)
      .where('needsRateReview', '==', true)
      .get();

    const commList = [];
    const agentIds = new Set();
    const dealIds = new Set();

    snap.forEach(d => {
      const data = d.data();
      commList.push({ id: d.id, ...data });
      if (data.agentId) agentIds.add(data.agentId);
      if (data.dealId) dealIds.add(data.dealId);
    });

    // Fetch agents and deals in parallel
    const [agentSnaps, dealSnaps] = await Promise.all([
      Promise.all(Array.from(agentIds).map(id => db.collection('agents').doc(id).get())),
      Promise.all(Array.from(dealIds).map(id => db.collection('deals').doc(id).get())),
    ]);

    const agents = {};
    agentSnaps.forEach(s => { if (s.exists) agents[s.id] = { full_name: getDisplayName(s.data()) }; });

    const deals = {};
    dealSnaps.forEach(s => { if (s.exists) deals[s.id] = { policyNumber: s.data().policyNumber }; });

    return { success: true, commissions: commList, agents, deals };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function resolveNeedsReview(commissionId, resolvedPercent) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.runTransaction(async (transaction) => {
      const commRef = db.collection('commissions').doc(commissionId);
      const commSnap = await transaction.get(commRef);
      if (!commSnap.exists) throw new Error("Commission not found");

      const data = commSnap.data();

      // Verify this commission belongs to the caller's agency
      if (data.agencyId !== caller.agencyId) throw new Error("Commission not found");

      const amount = data.premiumAmount * resolvedPercent / 100;

      transaction.update(commRef, {
        needsRateReview: false,
        commissionRatePercent: Number(resolvedPercent),
        commissionAmount: amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Phase 6: Increment pending metrics since they were skipped when needsRateReview was true
      incrementAgentMetrics(transaction, admin, db, data.agencyId, data.agentId, data.agentHierarchyPath, {
        commissionPending: amount
      });
    });

    // M-22: Audit trail for commission review resolution
    logActivity({
      category: 'admin',
      action: 'resolve_commission_review',
      actorId: caller.uid,
      description: `Resolved commission review for commission ${commissionId} at ${resolvedPercent}%`,
      targetId: commissionId,
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function processStatement(carrierId, parsedData, matchedLines) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (parsedData && parsedData.length > 5000) {
    return { success: false, error: 'File too large. Please import a CSV with 5000 rows or less.' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const importBatchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const BATCH_LIMIT = 500;
  let totalWritten = 0;

  try {
    // Split matchedLines into chunks of BATCH_LIMIT to respect Firestore batch write limits.
    // Each chunk is committed as an independent batch.
    const chunks = [];
    for (let i = 0; i < matchedLines.length; i += BATCH_LIMIT) {
      chunks.push(matchedLines.slice(i, i + BATCH_LIMIT));
    }

    // First batch: create the statement record
    const stmtRef = db.collection('carrierStatements').doc();
    const firstBatch = db.batch();
    firstBatch.set(stmtRef, {
      agencyId: caller.agencyId,
      carrierId,
      importBatchId,
      status: 'completed',
      totalLines: parsedData.length,
      matchedLines: matchedLines.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await firstBatch.commit();
    totalWritten++;

    let updatedCommissionsCount = 0;

    for (const chunk of chunks) {
      try {
        const chunkResult = await db.runTransaction(async (transaction) => {
          let chunkUpdated = 0;

          for (const line of chunk) {
            // Create Statement Line
            const lineRef = db.collection('carrierStatementLines').doc();
            transaction.set(lineRef, {
              statementId: stmtRef.id,
              agencyId: caller.agencyId,
              carrierId,
              importBatchId,
              policyNumber: line.csvData.PolicyNumber,
              commissionAmount: line.csvData.CommissionAmount,
              matchedCommissionId: line.matchedCommId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (line.matchedCommId) {
              // Update base commission
              const commRef = db.collection('commissions').doc(line.matchedCommId);
              const commSnap = await transaction.get(commRef);
              if (commSnap.exists) {
                const commData = commSnap.data();

                if (commData.status === 'paid') {
                  // Already paid — this is a trail/renewal commission payment
                  const trailRef = db.collection('commissions').doc();
                  transaction.set(trailRef, {
                    agencyId: commData.agencyId,
                    dealId: commData.dealId,
                    agentId: commData.agentId,
                    agentHierarchyPath: commData.agentHierarchyPath,
                    carrierId: commData.carrierId,
                    policyType: commData.policyType,
                    premiumAmount: Number(line.csvData.CommissionAmount),
                    commissionRatePercent: commData.commissionRatePercent || 0,
                    commissionAmount: Number(line.csvData.CommissionAmount),
                    commissionType: 'trail',
                    needsRateReview: false,
                    status: 'paid',
                    importBatchId,
                    matchedStatementLineId: lineRef.id,
                    actualPaidAmount: Number(line.csvData.CommissionAmount),
                    actualPaidDate: admin.firestore.FieldValue.serverTimestamp(),
                    expectedPayDate: null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  incrementAgentMetrics(transaction, admin, db, commData.agencyId, commData.agentId, commData.agentHierarchyPath, {
                    commissionPaid: Number(line.csvData.CommissionAmount)
                  });
                } else {
                  // First payment — mark the initial commission as paid
                  transaction.update(commRef, {
                    status: 'paid',
                    commissionType: commData.commissionType || 'initial',
                    importBatchId,
                    actualPaidAmount: Number(line.csvData.CommissionAmount),
                    actualPaidDate: admin.firestore.FieldValue.serverTimestamp(),
                    matchedStatementLineId: lineRef.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                  });

                  incrementAgentMetrics(transaction, admin, db, commData.agencyId, commData.agentId, commData.agentHierarchyPath, {
                    commissionPending: -(commData.commissionAmount || 0),
                    commissionPaid: Number(line.csvData.CommissionAmount)
                  });
                }

                chunkUpdated++;
              }

              // Cascade to overrides
              const overridesSnap = await transaction.get(
                db.collection('commissionOverrides').where('originatingCommissionId', '==', line.matchedCommId)
              );

              overridesSnap.forEach(oDoc => {
                const oData = oDoc.data();
                transaction.update(oDoc.ref, {
                  status: 'paid',
                  importBatchId,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                incrementAgentMetrics(transaction, admin, db, oData.agencyId, oData.beneficiaryAgentId, oData.beneficiaryHierarchyPath, {
                  overrideEarnedPending: -(oData.overrideAmount || 0),
                  overrideEarnedPaid: (oData.overrideAmount || 0)
                });
              });
            }
          }

          return chunkUpdated;
        });

        updatedCommissionsCount += chunkResult;
        totalWritten += chunk.length;
      } catch (batchError) {
        return {
          success: false,
          error: `Batch failed after ${totalWritten} docs written successfully. ${batchError.message}`,
          importBatchId,
          totalWritten,
        };
      }
    }

    return { success: true, id: stmtRef.id, importBatchId, updatedCommissionsCount };
  } catch (error) {
    return { success: false, error: error.message, importBatchId, totalWritten };
  }
}

export async function undoLastImport(importBatchId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  if (!importBatchId || typeof importBatchId !== 'string') {
    return { success: false, error: 'Invalid importBatchId.' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();
  const BATCH_LIMIT = 500;

  try {
    let totalDeleted = 0;

    // Delete carrier statement lines with this importBatchId
    const linesSnap = await db.collection('carrierStatementLines')
      .where('agencyId', '==', caller.agencyId)
      .where('importBatchId', '==', importBatchId)
      .get();

    const lineDocs = [];
    linesSnap.forEach(d => lineDocs.push(d.ref));

    for (let i = 0; i < lineDocs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const slice = lineDocs.slice(i, i + BATCH_LIMIT);
      slice.forEach(ref => batch.delete(ref));
      await batch.commit();
      totalDeleted += slice.length;
    }

    // Delete carrier statements with this importBatchId
    const stmtsSnap = await db.collection('carrierStatements')
      .where('agencyId', '==', caller.agencyId)
      .where('importBatchId', '==', importBatchId)
      .get();

    const stmtDocs = [];
    stmtsSnap.forEach(d => stmtDocs.push(d.ref));

    for (let i = 0; i < stmtDocs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const slice = stmtDocs.slice(i, i + BATCH_LIMIT);
      slice.forEach(ref => batch.delete(ref));
      await batch.commit();
      totalDeleted += slice.length;
    }

    // Revert commissions that were tagged with this importBatchId back to pending
    const commsSnap = await db.collection('commissions')
      .where('agencyId', '==', caller.agencyId)
      .where('importBatchId', '==', importBatchId)
      .get();

    const commDocs = [];
    commsSnap.forEach(d => commDocs.push(d));

    // Separate trail commissions (created by import) from updated commissions
    const trailRefs = [];
    const revertRefs = [];
    commDocs.forEach(d => {
      const data = d.data();
      if (data.commissionType === 'trail') {
        trailRefs.push(d.ref);
      } else {
        revertRefs.push(d.ref);
      }
    });

    // Delete trail commissions (they were created by the import)
    for (let i = 0; i < trailRefs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const slice = trailRefs.slice(i, i + BATCH_LIMIT);
      slice.forEach(ref => batch.delete(ref));
      await batch.commit();
      totalDeleted += slice.length;
    }

    // Revert updated commissions back to pending
    for (let i = 0; i < revertRefs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const slice = revertRefs.slice(i, i + BATCH_LIMIT);
      slice.forEach(ref => {
        batch.update(ref, {
          status: 'pending',
          importBatchId: admin.firestore.FieldValue.delete(),
          actualPaidAmount: admin.firestore.FieldValue.delete(),
          actualPaidDate: admin.firestore.FieldValue.delete(),
          matchedStatementLineId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      totalDeleted += slice.length;
    }

    // Revert overrides tagged with this importBatchId
    const overridesSnap = await db.collection('commissionOverrides')
      .where('agencyId', '==', caller.agencyId)
      .where('importBatchId', '==', importBatchId)
      .get();

    const overrideDocs = [];
    overridesSnap.forEach(d => overrideDocs.push(d.ref));

    for (let i = 0; i < overrideDocs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const slice = overrideDocs.slice(i, i + BATCH_LIMIT);
      slice.forEach(ref => {
        batch.update(ref, {
          status: 'pending',
          importBatchId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      totalDeleted += slice.length;
    }

    logActivity({
      category: 'admin',
      action: 'undo_commission_import',
      actorId: caller.uid,
      description: `Undid commission import batch ${importBatchId}, reverted ${totalDeleted} docs`,
      targetId: importBatchId,
    }).catch(() => {});

    return { success: true, totalDeleted };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
