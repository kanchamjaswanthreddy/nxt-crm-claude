import { NextResponse } from 'next/server';
import { stripe, getPriceForLevel, ensurePricesExist } from '@/lib/stripe';
import { AGENT_LEVELS } from '@/lib/constants';
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
 * POST /api/stripe/create-subscription
 * Creates a Stripe Subscription with 30-day trial after SetupIntent succeeds.
 * Body: { customerId, paymentMethodId, agentLevel, agentId }
 */
export async function POST(request) {
  let caller;
  try {
    caller = await requireUserFromRequest(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { customerId, paymentMethodId, agentLevel, agentId } = await request.json();

    if (!customerId || !paymentMethodId || !agentLevel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the customerId belongs to the caller by checking Firestore
    const admin = getAdminApp();
    const db = admin.firestore();
    const agentDoc = await db.collection('agents').doc(caller.uid).get();
    if (!agentDoc.exists) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const agentData = agentDoc.data();
    if (agentData.stripe_customer_id && agentData.stripe_customer_id !== customerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // If the agent doesn't have a stripe_customer_id yet, verify via Stripe metadata
    if (!agentData.stripe_customer_id) {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted || customer.metadata?.nxt_agent_id !== caller.uid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Attach payment method to customer and set as default.
    // SetupIntent may have already attached it, so handle gracefully.
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (attachErr) {
      const alreadyAttached =
        attachErr?.code === 'resource_already_exists' ||
        attachErr?.message?.includes('already been attached');
      if (!alreadyAttached) throw attachErr;
    }
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Get the price for this level (ensure prices exist first)
    let priceId = await getPriceForLevel(agentLevel);
    if (!priceId) {
      await ensurePricesExist(AGENT_LEVELS);
      priceId = await getPriceForLevel(agentLevel);
    }

    if (!priceId) {
      return NextResponse.json(
        { error: `No Stripe price found for level ${agentLevel}` },
        { status: 400 }
      );
    }

    // Create subscription with 30-day trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 30,
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata: {
        nxt_agent_id: agentId,
        nxt_level: String(agentLevel),
      },
    });

    // Get the payment method details for last4
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      trialEnd: subscription.trial_end,
      cardLast4: pm.card?.last4 || '',
      cardBrand: pm.card?.brand || '',
    });
  } catch (err) {
    console.error('Stripe create subscription error:', err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}
