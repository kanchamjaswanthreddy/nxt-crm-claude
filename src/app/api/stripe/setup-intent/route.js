import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireUserFromRequest } from '@/lib/serverAuth';
import { getAdminApp } from '@/lib/firebase/adminApp';

/**
 * Sanitize Stripe errors so internal IDs/details are never leaked to the client.
 */
function safeErrorMessage(err) {
  if (err?.type === 'StripeCardError') return err.message;
  if (err?.type?.startsWith?.('Stripe')) return 'A payment processing error occurred. Please try again.';
  return 'Something went wrong. Please try again.';
}

/**
 * POST /api/stripe/setup-intent
 * Creates a Stripe Customer + SetupIntent for collecting card during onboarding.
 * Body: { email, name }
 */
export async function POST(request) {
  let caller;
  try {
    caller = await requireUserFromRequest(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, name } = await request.json();
    const agentId = caller.uid;

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const admin = getAdminApp();
    const db = admin.firestore();
    const agentRef = db.collection('agents').doc(agentId);
    const agentDoc = await agentRef.get();

    // 1) If agent already has a stripe_customer_id in Firestore, reuse it
    if (agentDoc.exists) {
      const agentData = agentDoc.data();
      if (agentData.stripe_customer_id) {
        try {
          const existingCustomer = await stripe.customers.retrieve(agentData.stripe_customer_id);
          if (!existingCustomer.deleted) {
            const setupIntent = await stripe.setupIntents.create({
              customer: existingCustomer.id,
              payment_method_types: ['card'],
              metadata: { nxt_agent_id: agentId },
            });
            return NextResponse.json({
              clientSecret: setupIntent.client_secret,
              customerId: existingCustomer.id,
            });
          }
        } catch {
          // Customer ID in Firestore is invalid/deleted — fall through to create a new one
        }
      }
    }

    // 2) Search Stripe by email, but ONLY use a match if its metadata belongs to this agent.
    //    This prevents cross-agent collisions when two people share an email address.
    const existing = await stripe.customers.list({ email, limit: 10 });
    let customer = null;

    for (const c of existing.data) {
      if (c.metadata?.nxt_agent_id === agentId) {
        customer = c;
        break;
      }
    }

    // 3) No safe match — create a new customer
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        name: name || email,
        metadata: { nxt_agent_id: agentId },
      });
    }

    // 4) Atomically save customer ID to prevent race-condition duplicates.
    //    Uses Firestore transaction: if another request already wrote a different
    //    stripe_customer_id, we use that one instead.
    const finalCustomerId = await db.runTransaction(async (txn) => {
      const freshDoc = await txn.get(agentRef);
      const freshData = freshDoc.exists ? freshDoc.data() : {};

      if (freshData.stripe_customer_id && freshData.stripe_customer_id !== customer.id) {
        // Another request won the race — verify theirs is still valid
        try {
          const raceWinner = await stripe.customers.retrieve(freshData.stripe_customer_id);
          if (!raceWinner.deleted) return raceWinner.id;
        } catch {
          // Their customer is gone — ours wins
        }
      }

      txn.update(agentRef, { stripe_customer_id: customer.id });
      return customer.id;
    });

    // 5) Create SetupIntent to collect payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: finalCustomerId,
      payment_method_types: ['card'],
      metadata: { nxt_agent_id: agentId },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: finalCustomerId,
    });
  } catch (err) {
    console.error('Stripe setup intent error:', err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}
