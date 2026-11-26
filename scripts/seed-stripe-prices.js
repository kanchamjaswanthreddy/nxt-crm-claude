/**
 * One-time script to create Stripe Products and Prices for all NXT agent levels.
 * Run: node scripts/seed-stripe-prices.js
 */

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// Load .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const AGENT_LEVELS = [
  { level: 1, title: 'Unlicensed Associate', price: 10 },
  { level: 2, title: 'Financial Associate', price: 20 },
  { level: 3, title: 'Senior Financial Associate', price: 25 },
  { level: 4, title: 'Financial Director', price: 30 },
  { level: 5, title: 'Senior Financial Director', price: 40 },
];

async function seed() {
  console.log('Seeding Stripe products and prices...\n');

  for (const lvl of AGENT_LEVELS) {
    const lookupKey = `nxt_level_${lvl.level}_monthly`;

    // Check if price already exists
    const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (existing.data.length > 0) {
      console.log(`Level ${lvl.level} (${lvl.title}): Already exists — price ${existing.data[0].id}`);
      continue;
    }

    // Create product
    const product = await stripe.products.create({
      name: `NXT Level ${lvl.level} — ${lvl.title}`,
      description: `Monthly subscription for NXT ${lvl.title} (Level ${lvl.level})`,
      metadata: { nxt_level: String(lvl.level) },
    });

    // Create price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: lvl.price * 100,
      currency: 'usd',
      recurring: { interval: 'month' },
      lookup_key: lookupKey,
    });

    console.log(`Level ${lvl.level} (${lvl.title}): $${lvl.price}/mo — product ${product.id}, price ${price.id}`);
  }

  console.log('\nDone! All Stripe products and prices are ready.');
}

seed().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
