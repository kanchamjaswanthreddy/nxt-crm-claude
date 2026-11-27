'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { incrementAgentMetrics } from '@/app/actions/metrics';
import { onDealStageChanged, onDealWon } from '@/lib/dealAutomationHooks';
import { validateLengths, isRateLimited, FIELD_LIMITS } from '@/lib/validation';

const DEAL_UPDATE_ALLOWLIST = new Set([
  'leadId', 'stageId', 'policyType', 'carrierId', 'premiumAmount',
  'expectedCloseDate', 'status', 'policyNumber', 'lostReason',
  'isRenewal', 'notes', 'ownerHierarchyPath',
]);

export async function fetchDeals(hierarchyPath) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const query = db.collection('deals').where('agencyId', '==', caller.agencyId);
    const snapshot = await query.get();

    let deals = [];
    snapshot.forEach(doc => {
      const data = doc.data();

      // M-07: Skip soft-deleted deals
      if (data.deletedAt) return;

      let canSee = false;

      if (data.ownerAgentId === caller.uid) {
        canSee = true;
      } else if (data.ownerHierarchyPath && hierarchyPath && data.ownerHierarchyPath.startsWith(hierarchyPath + '/')) {
        canSee = true;
      } else if (caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner) {
        canSee = true;
      }

      if (canSee) {
        deals.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
          stageChangedAt: data.stageChangedAt ? data.stageChangedAt.toDate().toISOString() : null
        });
      }
    });

    return { success: true, deals };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function createDeal(data) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  if (isRateLimited(`deal-create:${caller.uid}`, 30, 3600000)) {
    return { success: false, error: 'Too many deals created. Please try again later.' };
  }

  const lengthErr = validateLengths([
    [data.policyNumber, 'Policy number', FIELD_LIMITS.policyNumber],
    [data.lostReason, 'Lost reason', FIELD_LIMITS.general],
    [data.notes, 'Notes', FIELD_LIMITS.note],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  // Always set agencyId and ownerAgentId from session — never trust client
  const agencyId = caller.agencyId;
  const ownerAgentId = caller.uid;

  const { leadId, ownerHierarchyPath, stageId, policyType, premiumAmount, expectedCloseDate, status, policyNumber, lostReason, isRenewal } = data;

  if (status === 'won' && !policyNumber) {
    return { success: false, error: 'Policy number is required for won deals.' };
  }
  if (status === 'lost' && !lostReason) {
    return { success: false, error: 'Lost reason is required for lost deals.' };
  }

  try {
    const newDealRef = db.collection('deals').doc();

    const dealData = {
      agencyId,
      leadId: leadId || null,
      ownerAgentId,
      ownerHierarchyPath: ownerHierarchyPath || null,
      stageId,
      policyType: policyType || 'other',
      premiumAmount: premiumAmount || null,
      expectedCloseDate: expectedCloseDate || null,
      status: status || 'open',
      policyNumber: policyNumber || null,
      lostReason: lostReason || null,
      isRenewal: isRenewal || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      stageChangedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.runTransaction(async (transaction) => {
      transaction.set(newDealRef, dealData);

      const historyRef = db.collection('dealStageHistory').doc();
      transaction.set(historyRef, {
        dealId: newDealRef.id,
        fromStageId: null,
        toStageId: stageId,
        changedByAgentId: ownerAgentId,
        changedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Phase 6: Track initial metrics
      if (status === 'open' || !status) {
        incrementAgentMetrics(transaction, admin, db, agencyId, ownerAgentId, ownerHierarchyPath, {
          dealsOpenCount: 1
        });
      } else if (status === 'won') {
        incrementAgentMetrics(transaction, admin, db, agencyId, ownerAgentId, ownerHierarchyPath, {
          dealsWonCount: 1,
          dealsWonPremiumTotal: premiumAmount || 0
        });
      } else if (status === 'lost') {
        incrementAgentMetrics(transaction, admin, db, agencyId, ownerAgentId, ownerHierarchyPath, {
          dealsLostCount: 1
        });
      }
    });

    return { success: true, id: newDealRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function moveDealStage(dealId, newStageId, updateData = {}) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const dealRef = db.collection('deals').doc(dealId);
    let dealDataForHook = null;
    let oldStageId = null;
    let newStatus = 'open';

    await db.runTransaction(async (realTransaction) => {
      // Firestore rejects any read that comes after a write in the same transaction, and this
      // function reads (task templates, lead, commission check, rates) after it has started writing.
      // So writes are queued here in their original order and applied once every read is done.
      const queuedWrites = [];
      const transaction = {
        get: (ref) => realTransaction.get(ref),
        set: (...args) => { queuedWrites.push(() => realTransaction.set(...args)); },
        update: (...args) => { queuedWrites.push(() => realTransaction.update(...args)); },
        delete: (...args) => { queuedWrites.push(() => realTransaction.delete(...args)); },
      };

      const dealSnap = await transaction.get(dealRef);
      if (!dealSnap.exists) {
        throw new Error("Deal not found.");
      }

      const currentData = dealSnap.data();

      // Verify the deal belongs to caller's agency
      if (currentData.agencyId !== caller.agencyId) {
        throw new Error("Unauthorized");
      }

      // Verify the caller owns the deal or is admin
      const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner;
      if (currentData.ownerAgentId !== caller.uid && !isAdmin) {
        throw new Error("Unauthorized");
      }

      oldStageId = currentData.stageId;

      if (oldStageId === newStageId) {
        throw new Error("Deal is already in this stage.");
      }

      const nextData = {
        stageId: newStageId,
        stageChangedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...updateData
      };

      if (updateData.status) {
        if (updateData.status === 'won') {
          if (!updateData.policyNumber && !currentData.policyNumber) {
            throw new Error("Policy number is required for won deals.");
          }
          if (!updateData.carrierId && !currentData.carrierId) {
            throw new Error("Carrier is required for won deals.");
          }
        }
        if (updateData.status === 'lost' && !updateData.lostReason) {
          throw new Error("Lost reason is required for lost deals.");
        }
        newStatus = updateData.status;
      }

      // Phase 6 Metrics tracking for Deal Status changes
      if (newStatus && newStatus !== currentData.status) {
        if (newStatus === 'won') {
          incrementAgentMetrics(transaction, admin, db, currentData.agencyId, currentData.ownerAgentId, currentData.ownerHierarchyPath, {
            dealsWonCount: 1,
            dealsOpenCount: -1,
            dealsWonPremiumTotal: nextData.premiumAmount || currentData.premiumAmount || 0
          });
        } else if (newStatus === 'lost') {
          incrementAgentMetrics(transaction, admin, db, currentData.agencyId, currentData.ownerAgentId, currentData.ownerHierarchyPath, {
            dealsLostCount: 1,
            dealsOpenCount: -1
          });
        } else if (currentData.status === 'won' && newStatus === 'open') {
          // Edge case: moving backwards
          incrementAgentMetrics(transaction, admin, db, currentData.agencyId, currentData.ownerAgentId, currentData.ownerHierarchyPath, {
            dealsWonCount: -1,
            dealsOpenCount: 1,
            dealsWonPremiumTotal: -(currentData.premiumAmount || 0)
          });
        } else if (currentData.status === 'lost' && newStatus === 'open') {
          incrementAgentMetrics(transaction, admin, db, currentData.agencyId, currentData.ownerAgentId, currentData.ownerHierarchyPath, {
            dealsLostCount: -1,
            dealsOpenCount: 1
          });
        }
      }

      transaction.update(dealRef, nextData);

      const historyRef = db.collection('dealStageHistory').doc();
      transaction.set(historyRef, {
        dealId,
        fromStageId: oldStageId,
        toStageId: newStageId,
        changedByAgentId: caller.uid,
        changedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Phase 4: Task Automation
      const templatesSnap = await transaction.get(
        db.collection('stageTaskTemplates')
          .where('agencyId', '==', currentData.agencyId)
          .where('triggerStageId', '==', newStageId)
          .where('active', '==', true)
      );

      // We need to fetch the lead to replace {{contactName}} if there's a lead attached
      let contactName = '';
      if (currentData.leadId) {
        const leadSnap = await transaction.get(db.collection('leads').doc(currentData.leadId));
        if (leadSnap.exists) {
          const lData = leadSnap.data();
          contactName = `${lData.firstName} ${lData.lastName}`;
        }
      }

      // Check idempotency (created within last 5 mins for this stage entry to prevent retry duplicate)
      const recentWindow = new Date(Date.now() - 5 * 60 * 1000);
      const recentTasksQuery = db.collection('tasks')
        .where('relatedDealId', '==', dealId)
        .where('autoGenerated', '==', true)
        .where('createdAt', '>=', recentWindow);
      const recentTasksSnap = await transaction.get(recentTasksQuery);
      const recentTemplateIds = new Set();
      recentTasksSnap.forEach(doc => {
        recentTemplateIds.add(doc.data().sourceTemplateId);
      });

      templatesSnap.forEach(tDoc => {
        const template = tDoc.data();
        if (recentTemplateIds.has(tDoc.id)) return; // Idempotency check: skip if we just generated it

        const taskRef = db.collection('tasks').doc();
        const dueAtMs = Date.now() + (template.daysUntilDue * 24 * 60 * 60 * 1000);

        const title = template.taskTitle.replace(/\{\{contactName\}\}/g, contactName || 'Contact');

        transaction.set(taskRef, {
          agencyId: currentData.agencyId,
          ownerAgentId: currentData.ownerAgentId,
          ownerHierarchyPath: currentData.ownerHierarchyPath,
          createdByAgentId: null,
          relatedLeadId: currentData.leadId || null,
          relatedDealId: dealId,
          title,
          description: `Auto-generated by entering stage: ${newStageId}`,
          dueAt: admin.firestore.Timestamp.fromMillis(dueAtMs),
          priority: template.priority || 'medium',
          status: 'open',
          completedAt: null,
          autoGenerated: true,
          sourceTemplateId: tDoc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // Phase 5: Commission & Override Calculation
      if (newStatus === 'won') {
        const finalCarrierId = nextData.carrierId || currentData.carrierId;
        const finalPolicyType = nextData.policyType || currentData.policyType;
        const finalPremiumAmount = nextData.premiumAmount || currentData.premiumAmount;

        // Ensure idempotency for commissions - check if one already exists for this deal
        const existingCommSnap = await transaction.get(db.collection('commissions').where('dealId', '==', dealId));
        if (existingCommSnap.empty && finalPremiumAmount != null) {

          let currentAgentId = currentData.ownerAgentId;
          let currentAgentDoc = await transaction.get(db.collection('agents').doc(currentAgentId));

          let needsRateReview = false;
          let baseCommissionRate = 0;
          let currentLevelPercent = 0;

          if (currentAgentDoc.exists) {
            const agentData = currentAgentDoc.data();
            const contractLevel = agentData.contractLevel;

            if (!contractLevel) {
              needsRateReview = true;
            } else {
              // Find rate
              const todayIso = new Date().toISOString().split('T')[0];
              const rateQuery = db.collection('commissionRates')
                .where('agencyId', '==', currentData.agencyId)
                .where('carrierId', '==', finalCarrierId)
                .where('policyType', '==', finalPolicyType)
                .where('agentLevel', '==', contractLevel)
                .where('effectiveDate', '<=', todayIso)
                .orderBy('effectiveDate', 'desc')
                .limit(1);

              const rateSnap = await transaction.get(rateQuery);
              if (rateSnap.empty) {
                needsRateReview = true;
              } else {
                baseCommissionRate = rateSnap.docs[0].data().commissionPercent;
                currentLevelPercent = baseCommissionRate;
              }
            }

            const commissionAmount = needsRateReview ? null : (finalPremiumAmount * baseCommissionRate / 100);

            // Create Base Commission
            const commRef = db.collection('commissions').doc();
            transaction.set(commRef, {
              agencyId: currentData.agencyId,
              dealId: dealId,
              agentId: currentAgentId,
              agentHierarchyPath: currentData.ownerHierarchyPath,
              carrierId: finalCarrierId,
              policyType: finalPolicyType,
              premiumAmount: finalPremiumAmount,
              commissionRatePercent: baseCommissionRate,
              commissionAmount: commissionAmount,
              commissionType: 'initial',
              needsRateReview: needsRateReview,
              status: 'pending',
              matchedStatementLineId: null,
              expectedPayDate: null,
              actualPaidDate: null,
              actualPaidAmount: null,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (!needsRateReview && commissionAmount) {
              incrementAgentMetrics(transaction, admin, db, currentData.agencyId, currentAgentId, currentData.ownerHierarchyPath, {
                commissionPending: commissionAmount
              });
            }

            // Walk Upline Chain
            let uplineId = agentData.uplineId;
            let safetyLimit = 20; // prevent infinite loops

            while (uplineId && safetyLimit > 0) {
              safetyLimit--;
              let uplineDoc = await transaction.get(db.collection('agents').doc(uplineId));
              if (!uplineDoc.exists) break;

              let uplineData = uplineDoc.data();
              if (uplineData.contractLevel) {
                const uRateQuery = db.collection('commissionRates')
                  .where('agencyId', '==', currentData.agencyId)
                  .where('carrierId', '==', finalCarrierId)
                  .where('policyType', '==', finalPolicyType)
                  .where('agentLevel', '==', uplineData.contractLevel)
                  .where('effectiveDate', '<=', new Date().toISOString().split('T')[0])
                  .orderBy('effectiveDate', 'desc')
                  .limit(1);

                const uRateSnap = await transaction.get(uRateQuery);
                if (!uRateSnap.empty) {
                  const uplinePercent = uRateSnap.docs[0].data().commissionPercent;

                  if (uplinePercent > currentLevelPercent) {
                    const overridePercent = uplinePercent - currentLevelPercent;
                    const overrideAmount = (finalPremiumAmount * overridePercent / 100);

                    const overrideRef = db.collection('commissionOverrides').doc();
                    transaction.set(overrideRef, {
                      agencyId: currentData.agencyId,
                      originatingCommissionId: commRef.id,
                      dealId: dealId,
                      beneficiaryAgentId: uplineId,
                      beneficiaryHierarchyPath: uplineData.hierarchyPath,
                      overridePercent: overridePercent,
                      overrideAmount: overrideAmount,
                      status: 'pending',
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    incrementAgentMetrics(transaction, admin, db, currentData.agencyId, uplineId, uplineData.hierarchyPath, {
                      overrideEarnedPending: overrideAmount
                    });


                    currentLevelPercent = uplinePercent; // Level up
                  }
                }
              }
              uplineId = uplineData.uplineId;
            }
          }
        }
      }

      dealDataForHook = { id: dealId, ...currentData, ...nextData };

      // All reads are finished: apply the queued writes in order.
      queuedWrites.forEach(write => write());
    });

    // Call Automation Hooks immediately after transaction succeeds
    if (dealDataForHook) {
      // Intentionally not awaiting these so they don't block the UI response
      onDealStageChanged({ deal: dealDataForHook, fromStageId: oldStageId, toStageId: newStageId, changedByAgentId: caller.uid }).catch(() => {});

      if (newStatus === 'won') {
        onDealWon({ deal: dealDataForHook }).catch(() => {});
      }
    }

    return { success: true };
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: error.message };
  }
}

export async function fetchDealStageHistory(dealId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the deal belongs to caller's agency
    const dealSnap = await db.collection('deals').doc(dealId).get();
    if (!dealSnap.exists) return { success: false, error: 'Deal not found.' };
    if (dealSnap.data().agencyId !== caller.agencyId) return { success: false, error: 'Unauthorized' };

    const snap = await db.collection('dealStageHistory')
      .where('dealId', '==', dealId)
      .orderBy('changedAt', 'desc')
      .limit(100)
      .get();

    const history = [];
    snap.forEach(doc => {
      const data = doc.data();
      history.push({
        id: doc.id,
        dealId: data.dealId,
        fromStageId: data.fromStageId || null,
        toStageId: data.toStageId || null,
        changedByAgentId: data.changedByAgentId || null,
        changedAt: data.changedAt ? data.changedAt.toDate().toISOString() : null,
      });
    });

    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateDeal(dealId, data) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the deal belongs to caller's agency and caller owns it or is admin
    const dealSnap = await db.collection('deals').doc(dealId).get();
    if (!dealSnap.exists) return { success: false, error: 'Deal not found.' };
    const currentData = dealSnap.data();

    if (currentData.agencyId !== caller.agencyId) {
      return { success: false, error: 'Unauthorized' };
    }
    const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner;
    if (currentData.ownerAgentId !== caller.uid && !isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Apply field allowlist — strip any fields not in the allowed set
    const safeData = {};
    for (const key of Object.keys(data)) {
      if (DEAL_UPDATE_ALLOWLIST.has(key)) {
        safeData[key] = data[key];
      }
    }

    const lengthErr = validateLengths([
      [safeData.policyNumber, 'Policy number', FIELD_LIMITS.policyNumber],
      [safeData.lostReason, 'Lost reason', FIELD_LIMITS.general],
      [safeData.notes, 'Notes', FIELD_LIMITS.note],
    ]);
    if (lengthErr) return { success: false, error: lengthErr };

    const nextData = {
      ...safeData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Status gated checks
    if (nextData.status === 'won' && !nextData.policyNumber) {
      if (!currentData.policyNumber && !safeData.policyNumber) {
        return { success: false, error: 'Policy number is required for won deals.' };
      }
    }
    if (nextData.status === 'lost' && !nextData.lostReason) {
      if (!currentData.lostReason && !safeData.lostReason) {
        return { success: false, error: 'Lost reason is required for lost deals.' };
      }
    }

    await db.collection('deals').doc(dealId).update(nextData);

    // If status changed to won
    if (safeData.status === 'won') {
      const updatedSnap = await db.collection('deals').doc(dealId).get();
      onDealWon({ deal: { id: dealId, ...updatedSnap.data() } }).catch(() => {});
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteDeal(dealId) {
  let caller;
  try {
    caller = await requireUser();
  } catch {
    return { success: false, error: 'Unauthorized' };
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Verify the deal belongs to caller's agency and caller owns it or is admin
    const dealSnap = await db.collection('deals').doc(dealId).get();
    if (!dealSnap.exists) return { success: false, error: 'Deal not found.' };
    const currentData = dealSnap.data();

    if (currentData.agencyId !== caller.agencyId) {
      return { success: false, error: 'Unauthorized' };
    }
    const isAdmin = caller.role === 'admin' || caller.role === 'it_engineer' || caller.isOwner;
    if (currentData.ownerAgentId !== caller.uid && !isAdmin) {
      return { success: false, error: 'Unauthorized' };
    }

    // M-07: Soft delete — mark deletedAt/deletedBy instead of hard-deleting
    await db.collection('deals').doc(dealId).update({
      deletedAt: new Date().toISOString(),
      deletedBy: caller.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
