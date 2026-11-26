import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUserFromRequest } from '@/lib/serverAuth';

/**
 * Sanitize Stripe errors so internal IDs/details are never leaked to the client.
 */
function safeErrorMessage(err) {
  if (err?.type === 'StripeCardError') return err.message;
  if (err?.type?.startsWith?.('Stripe')) return 'A payment processing error occurred. Please try again.';
  return 'Something went wrong. Please try again.';
}

/**
 * POST /api/stripe/update-payment-method
 * Updates the default payment method for an existing customer/subscription.
 * Body: { customerId, paymentMethodId }
 */
export async function POST(request) {
  let caller;
  try {
    caller = await requireUserFromRequest(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { customerId, paymentMethodId } = await request.json();

    // agentId comes from the verified session, not the request body
    const agentId = caller.uid;

    if (!customerId || !paymentMethodId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify customerId belongs to the caller
    const admin = getAdminApp();
    const db = admin.firestore();
    const agentDoc = await db.collection('agents').doc(caller.uid).get();
    if (!agentDoc.exists) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
    }
    const agentData = agentDoc.data();

    // Verify ownership: check Firestore record or Stripe metadata
    if (agentData.stripe_customer_id && agentData.stripe_customer_id !== customerId) {
      return NextResponse.json({ error: 'Customer mismatch' }, { status: 403 });
    }
    if (!agentData.stripe_customer_id) {
      // Verify via Stripe metadata as fallback, then save it
      const stripeCustomer = await stripe.customers.retrieve(customerId);
      if (stripeCustomer.deleted || stripeCustomer.metadata?.nxt_agent_id !== caller.uid) {
        return NextResponse.json({ error: 'Customer mismatch' }, { status: 403 });
      }
      await db.collection('agents').doc(caller.uid).update({ stripe_customer_id: customerId });
    }

    // Attach the payment method to the customer.
    // SetupIntent may have already attached it, so handle the "already attached" case gracefully.
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (attachErr) {
      // "The payment method you provided has already been attached to a customer"
      // is expected when SetupIntent auto-attaches — safe to continue.
      const alreadyAttached =
        attachErr?.code === 'resource_already_exists' ||
        attachErr?.message?.includes('already been attached');
      if (!alreadyAttached) {
        throw attachErr;
      }
    }

    // Set as default payment method on customer
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Also update default on any active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5,
    });

    for (const sub of subscriptions.data) {
      if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
        await stripe.subscriptions.update(sub.id, {
          default_payment_method: paymentMethodId,
        });
      }
    }

    // Get card details + billing zip
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const cardLast4 = pm.card?.last4 || '';
    const cardBrand = pm.card?.brand || '';
    const billingZip = pm.billing_details?.address?.postal_code || '';

    // Update Firestore agent document (including billingZip)
    await db.collection('agents').doc(agentId).update({
      'payment.cardLastFour': cardLast4,
      'payment.cardBrand': cardBrand,
      'payment.billingZip': billingZip,
      'payment.updatedAt': new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      cardLast4,
      cardBrand,
    });
  } catch (err) {
    console.error('Stripe update payment method error:', err);
    return NextResponse.json({ error: safeErrorMessage(err) }, { status: 500 });
  }
}
