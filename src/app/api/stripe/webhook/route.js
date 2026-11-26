import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAdminApp } from '@/lib/firebase/adminApp';

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events to keep Firestore in sync.
 */
export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = getAdminApp();
  const db = admin.firestore();

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const agentId = await findAgentByCustomerId(db, customerId);

        if (agentId) {
          // Update subscription status to active
          await db.collection('agents').doc(agentId).update({
            subscriptionStatus: 'active',
          });

          // Record the transaction
          await db.collection('billingTransactions').add({
            agentId,
            agencyId: (await db.collection('agents').doc(agentId).get()).data()?.agency_id || null,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: 'paid',
            date: new Date(invoice.created * 1000).toISOString(),
            description: invoice.lines?.data?.[0]?.description || 'Monthly subscription',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const agentId = await findAgentByCustomerId(db, customerId);

        if (agentId) {
          await db.collection('agents').doc(agentId).update({
            subscriptionStatus: 'past_due',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const agentId = await findAgentByCustomerId(db, customerId);

        if (agentId) {
          const statusMap = {
            active: 'active',
            trialing: 'trial',
            past_due: 'past_due',
            canceled: 'cancelled',
            unpaid: 'past_due',
          };

          const updates = {
            subscriptionStatus: statusMap[subscription.status] || subscription.status,
          };

          if (subscription.current_period_end) {
            updates.nextChargeDate = new Date(subscription.current_period_end * 1000).toISOString();
          }

          await db.collection('agents').doc(agentId).update(updates);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const agentId = await findAgentByCustomerId(db, customerId);

        if (agentId) {
          await db.collection('agents').doc(agentId).update({
            subscriptionStatus: 'cancelled',
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function findAgentByCustomerId(db, customerId) {
  const snap = await db.collection('agents')
    .where('stripe_customer_id', '==', customerId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}
