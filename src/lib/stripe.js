import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
});

/**
 * Lookup keys for each agent level price.
 * These are set when creating prices in Stripe so we don't need to store price IDs.
 */
export function getLevelLookupKey(level) {
  return `nxt_level_${level}_monthly`;
}

/**
 * Ensure Stripe Products and Prices exist for all agent levels.
 * Uses lookup_key for idempotent price retrieval.
 * Returns a map of level -> priceId.
 */
export async function ensurePricesExist(agentLevels) {
  const priceMap = {};

  for (const lvl of agentLevels) {
    const lookupKey = getLevelLookupKey(lvl.level);

    // Try to find existing price by lookup key
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });

    if (existing.data.length > 0) {
      priceMap[lvl.level] = existing.data[0].id;
      continue;
    }

    // Create product
    const product = await stripe.products.create({
      name: `NXT Level ${lvl.level} — ${lvl.title}`,
      metadata: { nxt_level: String(lvl.level) },
    });

    // Create price with lookup key
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: lvl.price * 100, // cents
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
    });

    priceMap[lvl.level] = price.id;
  }

  return priceMap;
}

/**
 * Get the Stripe Price ID for a given agent level.
 */
export async function getPriceForLevel(level) {
  const lookupKey = getLevelLookupKey(level);
  const result = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (result.data.length > 0) return result.data[0].id;
  return null;
}
