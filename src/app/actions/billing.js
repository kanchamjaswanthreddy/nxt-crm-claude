'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { sendPaymentReminderEmail } from '@/lib/email/resend';
import { requireUser, requireAdmin } from '@/lib/serverAuth';
import { isSubscriptionExempt, getDisplayName, AGENT_LEVELS } from '@/lib/constants';
import { stripe, getPriceForLevel, ensurePricesExist } from '@/lib/stripe';
import { validateLengths, FIELD_LIMITS } from '@/lib/validation';

/**
 * List all agents who should have card details but don't.
 * Excludes: owner, it_engineer, billingExempt agents.
 */
export async function getAgentsMissingPayment() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const missing = [];
    const withCard = [];
    let exempt = 0;

    snap.forEach(d => {
      const data = d.data();

      // Skip exempt agents
      if (isSubscriptionExempt(data)) {
        exempt++;
        return;
      }

      const hasCard = !!(data.stripe_customer_id && data.stripe_subscription_id && data.payment?.cardLastFour);

      const info = {
        id: d.id,
        name: getDisplayName(data) || data.email || 'Unknown',
        email: data.email || '',
        role: data.role || 'agent',
        status: data.status || 'unknown',
        subscriptionStatus: data.subscriptionStatus || 'none',
        stripeCustomerId: data.stripe_customer_id || null,
        stripeSubscriptionId: data.stripe_subscription_id || null,
        cardLastFour: data.payment?.cardLastFour || null,
        createdAt: data.created_at || null,
      };

      if (hasCard) {
        withCard.push(info);
      } else {
        missing.push(info);
      }
    });

    return {
      success: true,
      missing,
      withCard,
      withCardCount: withCard.length,
      exempt,
      total: snap.size,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getSubscriptionStatus() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentDoc = await db.collection('agents').doc(caller.uid).get();
    if (!agentDoc.exists) return { success: false, error: 'Agent not found.' };

    const data = agentDoc.data();
    let nextChargeDate = data.nextChargeDate || null;
    let subscriptionStatus = data.subscriptionStatus || 'none';

    // Backfill from Stripe if we have Stripe info but no nextChargeDate
    if (!nextChargeDate && (data.stripe_subscription_id || data.stripe_customer_id)) {
      try {
        let sub = null;
        if (data.stripe_subscription_id) {
          sub = await stripe.subscriptions.retrieve(data.stripe_subscription_id);
        }
        if (!sub && data.stripe_customer_id) {
          const subs = await stripe.subscriptions.list({
            customer: data.stripe_customer_id,
            limit: 1,
            status: 'all',
          });
          if (subs.data.length > 0) sub = subs.data[0];
        }
        if (sub && sub.current_period_end) {
          nextChargeDate = new Date(sub.current_period_end * 1000).toISOString();
          const statusMap = { active: 'active', trialing: 'trial', past_due: 'past_due', canceled: 'cancelled', unpaid: 'past_due' };
          subscriptionStatus = statusMap[sub.status] || sub.status;
          const updates = { nextChargeDate, subscriptionStatus };
          if (!data.stripe_subscription_id && sub.id) updates.stripe_subscription_id = sub.id;
          await db.collection('agents').doc(caller.uid).update(updates);
        }
      } catch (err) {
        // Subscription may no longer exist in Stripe
      }
    }

    return {
      success: true,
      data: {
        agentLevel: data.agentLevel || 1,
        contractLevel: data.contractLevel || 'Unlicensed Associate',
        subscriptionStatus,
        trialStartDate: data.trialStartDate || null,
        nextChargeDate,
        payment: data.payment ? {
          cardLastFour: data.payment.cardLastFour,
          billingZip: data.payment.billingZip,
          updatedAt: data.payment.updatedAt || data.payment.consentedAt,
        } : null,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updatePaymentMethod(paymentData) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const lengthErr = validateLengths([
    [paymentData.cardLastFour, 'Card last four', FIELD_LIMITS.ssn4],
    [paymentData.billingZip, 'Billing ZIP', FIELD_LIMITS.zip],
  ]);
  if (lengthErr) return { success: false, error: lengthErr };

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    await db.collection('agents').doc(caller.uid).update({
      'payment.cardLastFour': paymentData.cardLastFour,
      'payment.billingZip': paymentData.billingZip,
      'payment.updatedAt': new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getBillingHistory() {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized', transactions: [] }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const isAdmin = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';

    let query;
    if (isAdmin) {
      // Admins see all agency transactions
      query = db.collection('billingTransactions')
        .where('agencyId', '==', caller.agencyId)
        .orderBy('date', 'desc')
        .limit(50);
    } else {
      // Regular agents see only their own transactions
      query = db.collection('billingTransactions')
        .where('agentId', '==', caller.uid)
        .orderBy('date', 'desc')
        .limit(50);
    }

    const snap = await query.get();
    const transactions = [];
    snap.forEach(d => transactions.push({ id: d.id, ...d.data() }));

    return { success: true, transactions };
  } catch (error) {
    return { success: false, error: error.message, transactions: [] };
  }
}

export async function getAgencyBillingSummary() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Get all agents in agency with their subscription info
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const agents = [];
    let activeCount = 0;
    let trialCount = 0;
    const backfillPromises = [];

    snap.forEach(d => {
      const data = d.data();
      const level = data.agentLevel || 1;
      const status = data.subscriptionStatus || 'none';
      agents.push({
        id: d.id,
        name: getDisplayName(data) || data.email || 'Unknown',
        agentLevel: level,
        contractLevel: data.contractLevel || 'Unlicensed Associate',
        subscriptionStatus: status,
        trialStartDate: data.trialStartDate || null,
        nextChargeDate: data.nextChargeDate || null,
        stripe_subscription_id: data.stripe_subscription_id || null,
        stripe_customer_id: data.stripe_customer_id || null,
        is_owner: data.is_owner || false,
        role: data.role,
        billingExempt: data.billingExempt || false,
      });

      if (status === 'active') {
        activeCount++;
      } else if (status === 'trial') {
        trialCount++;
      }
    });

    // Backfill nextChargeDate from Stripe for agents missing it
    const needsBackfill = agents.filter(a => !a.nextChargeDate && (a.stripe_subscription_id || a.stripe_customer_id));
    if (needsBackfill.length > 0) {
      await Promise.allSettled(
        needsBackfill.map(async (agent) => {
          try {
            let sub = null;

            // Try direct subscription lookup first
            if (agent.stripe_subscription_id) {
              sub = await stripe.subscriptions.retrieve(agent.stripe_subscription_id);
            }
            // Fall back to listing subscriptions by customer ID
            if (!sub && agent.stripe_customer_id) {
              const subs = await stripe.subscriptions.list({
                customer: agent.stripe_customer_id,
                limit: 1,
                status: 'all',
              });
              if (subs.data.length > 0) {
                sub = subs.data[0];
              }
            }

            if (sub && sub.current_period_end) {
              const date = new Date(sub.current_period_end * 1000).toISOString();
              agent.nextChargeDate = date;
              const statusMap = { active: 'active', trialing: 'trial', past_due: 'past_due', canceled: 'cancelled', unpaid: 'past_due' };
              const mappedStatus = statusMap[sub.status] || sub.status;
              agent.subscriptionStatus = mappedStatus;
              // Persist to Firestore so we don't re-fetch next time
              const firestoreUpdate = { nextChargeDate: date, subscriptionStatus: mappedStatus };
              if (!agent.stripe_subscription_id && sub.id) {
                firestoreUpdate.stripe_subscription_id = sub.id;
              }
              await db.collection('agents').doc(agent.id).update(firestoreUpdate);
            }
          } catch (err) {
            // Subscription may no longer exist in Stripe — skip silently
          }
        })
      );
    }

    // Strip internal fields before returning
    agents.forEach(a => { delete a.stripe_subscription_id; delete a.stripe_customer_id; });

    return {
      success: true,
      agents,
      summary: { activeCount, trialCount, totalAgents: agents.length },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function sendPaymentReminders() {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    // Get all agents missing payment
    const snap = await db.collection('agents')
      .where('agency_id', '==', caller.agencyId)
      .get();

    const sent = [];
    const failed = [];
    const skipped = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      // Skip exempt agents
      if (isSubscriptionExempt(data)) {
        continue;
      }

      const hasCard = !!(data.stripe_customer_id && data.stripe_subscription_id && data.payment?.cardLastFour);
      if (hasCard) continue;

      if (!data.email) {
        skipped.push({ id: doc.id, name: getDisplayName(data) || 'Unknown', reason: 'No email' });
        continue;
      }

      // Delay between sends to avoid Resend rate limit (10 req/s)
      if (sent.length > 0 || failed.length > 0) {
        await new Promise(r => setTimeout(r, 150));
      }

      try {
        await sendPaymentReminderEmail({ to: data.email, name: getDisplayName(data) });
        sent.push({ id: doc.id, name: getDisplayName(data) || 'Unknown', email: data.email });
      } catch (err) {
        failed.push({ id: doc.id, name: getDisplayName(data) || 'Unknown', email: data.email, error: err.message });
      }
    }

    return { success: true, sent, failed, skipped };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Admin action: toggle billing exemption for an agent.
 */
export async function toggleBillingExempt(agentId, exempt) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) return { success: false, error: 'Agent not found.' };
    const data = agentDoc.data();
    if (data.agency_id !== caller.agencyId) return { success: false, error: 'Agent is not in your agency.' };

    await db.collection('agents').doc(agentId).update({ billingExempt: !!exempt });
    return { success: true, billingExempt: !!exempt, agentName: getDisplayName(data) || data.email || 'Unknown' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Admin action: create a Stripe subscription for an agent who doesn't have one.
 * Creates a Stripe customer (if needed) and subscription with 30-day trial.
 * Agent can add their payment method during the trial period.
 */
export async function adminCreateSubscription(agentId) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) return { success: false, error: 'Agent not found.' };

    const data = agentDoc.data();

    // Verify same agency
    if (data.agency_id !== caller.agencyId) {
      return { success: false, error: 'Agent is not in your agency.' };
    }

    // Skip exempt agents
    if (isSubscriptionExempt(data)) {
      return { success: false, error: 'This agent is exempt from subscriptions.' };
    }

    // Check if already has an active subscription (by ID or customer lookup)
    if (data.stripe_subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(data.stripe_subscription_id);
        if (['active', 'trialing'].includes(existing.status)) {
          // Subscription exists — just backfill Firestore and return success
          const trialEnd = existing.current_period_end
            ? new Date(existing.current_period_end * 1000).toISOString()
            : null;
          const statusMap = { active: 'active', trialing: 'trial', past_due: 'past_due', canceled: 'cancelled' };
          await db.collection('agents').doc(agentId).update({
            subscriptionStatus: statusMap[existing.status] || existing.status,
            nextChargeDate: trialEnd,
          });
          return { success: true, subscriptionId: existing.id, trialEnd, agentName: getDisplayName(data) || data.email || 'Unknown', alreadyExisted: true };
        }
      } catch {
        // Subscription no longer exists in Stripe, proceed
      }
    } else if (data.stripe_customer_id) {
      // No subscription ID stored but has customer — check if Stripe has one
      try {
        const subs = await stripe.subscriptions.list({ customer: data.stripe_customer_id, limit: 1, status: 'all' });
        if (subs.data.length > 0 && ['active', 'trialing'].includes(subs.data[0].status)) {
          const sub = subs.data[0];
          const trialEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          const statusMap = { active: 'active', trialing: 'trial', past_due: 'past_due', canceled: 'cancelled' };
          await db.collection('agents').doc(agentId).update({
            stripe_subscription_id: sub.id,
            subscriptionStatus: statusMap[sub.status] || sub.status,
            nextChargeDate: trialEnd,
          });
          return { success: true, subscriptionId: sub.id, trialEnd, agentName: getDisplayName(data) || data.email || 'Unknown', alreadyExisted: true };
        }
      } catch {
        // Customer may not exist anymore, proceed
      }
    }

    // Step 1: Get or create Stripe customer
    let customerId = data.stripe_customer_id;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if (existing.deleted) customerId = null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: data.email || undefined,
        name: getDisplayName(data) || undefined,
        metadata: { nxt_agent_id: agentId },
      });
      customerId = customer.id;
    }

    // Step 2: Get price for agent's level
    const level = data.agentLevel || 1;
    let priceId = await getPriceForLevel(level);
    if (!priceId) {
      await ensurePricesExist(AGENT_LEVELS);
      priceId = await getPriceForLevel(level);
    }
    if (!priceId) {
      return { success: false, error: `No Stripe price configured for level ${level}.` };
    }

    // Step 3: Calculate trial days from agent's original join date
    const joinDate = data.onboarding_completed_at || data.created_at || data.trialStartDate || null;
    let trialDaysRemaining = 30; // default if no join date found
    let originalJoinDate = null;

    if (joinDate) {
      const joined = new Date(typeof joinDate === 'object' && joinDate.toDate ? joinDate.toDate() : joinDate);
      originalJoinDate = joined.toISOString();
      const daysSinceJoin = Math.floor((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24));
      trialDaysRemaining = Math.max(0, 30 - daysSinceJoin);
    }

    // Create subscription — trial from join date (remaining days), or immediate if trial expired
    const subParams = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        nxt_agent_id: agentId,
        nxt_level: String(level),
      },
    };

    if (trialDaysRemaining > 0) {
      subParams.trial_period_days = trialDaysRemaining;
    }

    const subscription = await stripe.subscriptions.create(subParams);

    // Step 4: Update Firestore
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : (subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null);

    const subStatus = trialDaysRemaining > 0 ? 'trial' : 'active';

    await db.collection('agents').doc(agentId).update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscriptionStatus: subStatus,
      trialStartDate: originalJoinDate || new Date().toISOString(),
      nextChargeDate: trialEnd,
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      trialEnd,
      trialDaysRemaining,
      agentName: getDisplayName(data) || data.email || 'Unknown',
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
